import { MessengerAuthProvider } from "@/generated/prisma";
import {
  bindMessengerStart,
  getMessengerPhoneAuthReturnUrl,
  verifyMessengerContact,
} from "@/lib/messenger-auth";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { id?: number | string; is_bot?: boolean };
    contact?: {
      phone_number?: string;
      user_id?: number | string;
    };
  };
};

type TelegramWebhookResponse = {
  method: "sendMessage";
  chat_id: string | number;
  text: string;
  reply_markup?: Record<string, unknown>;
};

type MaxUser = {
  user_id?: number | string;
};

type MaxMessage = {
  sender?: MaxUser;
  recipient?: {
    chat_id?: number | string;
    user_id?: number | string;
  };
  body?: {
    text?: string;
    attachments?: Array<{
      type?: string;
      payload?: Record<string, unknown>;
    }>;
  };
};

type MaxUpdate = {
  update_type?: string;
  payload?: string;
  start_payload?: string;
  chat_id?: number | string;
  user?: MaxUser;
  message?: MaxMessage;
  body?: MaxMessage["body"];
  sender?: MaxUser;
  recipient?: MaxMessage["recipient"];
};

function getMaxToken() {
  return process.env.MAX_BOT_TOKEN?.trim();
}

function readStartToken(text?: string | null) {
  const match = text?.trim().match(/^\/start(?:@\S+)?(?:\s+(.+))?$/);
  return match?.[1]?.trim() || null;
}

function telegramWebhookMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: Record<string, unknown>,
): TelegramWebhookResponse {
  return {
    method: "sendMessage",
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };
}

function contactReplyKeyboard() {
  return {
    keyboard: [
      [
        {
          text: "Поделиться телефоном",
          request_contact: true,
        },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function removeTelegramKeyboard() {
  return { remove_keyboard: true };
}

export async function handleTelegramWebhook(
  update: TelegramUpdate,
): Promise<TelegramWebhookResponse | undefined> {
  const message = update.message;

  if (!message?.chat?.id || !message.from?.id) {
    return;
  }

  const startToken = readStartToken(message.text);

  if (startToken) {
    const result = await bindMessengerStart(
      MessengerAuthProvider.TELEGRAM,
      startToken,
      message.from.id,
      message.chat.id,
    );

    if ("reason" in result) {
      return telegramWebhookMessage(
        message.chat.id,
        result.reason ?? "Не удалось начать подтверждение телефона",
      );
    }

    return telegramWebhookMessage(
      message.chat.id,
      "Нажмите кнопку ниже, чтобы подтвердить номер телефона для входа или регистрации в АлексФрут.",
      contactReplyKeyboard(),
    );
  }

  if (message.contact?.phone_number) {
    const result = await verifyMessengerContact({
      provider: MessengerAuthProvider.TELEGRAM,
      messengerUserId: message.from.id,
      messengerChatId: message.chat.id,
      contactPhone: message.contact.phone_number,
      telegramContactUserId: message.contact.user_id,
    });

    return telegramWebhookMessage(
      message.chat.id,
      result.ok
        ? "Телефон подтверждён. Вернитесь на сайт, чтобы завершить вход или регистрацию."
        : result.reason,
      result.ok ? removeTelegramKeyboard() : undefined,
    );
  }
}

function getMaxApiBase() {
  return (process.env.MAX_BOT_API_BASE || "https://platform-api.max.ru").replace(/\/$/, "");
}

async function sendMaxMessage(
  userId: string | number,
  text: string,
  attachments?: Array<Record<string, unknown>>,
) {
  const token = getMaxToken();

  if (!token) {
    throw new Error("MAX_BOT_TOKEN is not configured");
  }

  const url = new URL(`${getMaxApiBase()}/messages`);
  url.searchParams.set("user_id", String(userId));

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      ...(attachments ? { attachments } : {}),
    }),
  });
}

function maxContactKeyboard() {
  return [
    {
      type: "inline_keyboard",
      payload: {
        buttons: [
          [
            {
              type: "request_contact",
              text: "Поделиться телефоном",
            },
          ],
        ],
      },
    },
  ];
}

function maxReturnKeyboard(returnUrl: string) {
  return [
    {
      type: "inline_keyboard",
      payload: {
        buttons: [
          [
            {
              type: "link",
              text: "Вернуться в приложение",
              url: returnUrl,
            },
          ],
        ],
      },
    },
  ];
}

function getMaxMessage(update: MaxUpdate): MaxMessage {
  return update.message ?? {
    sender: update.sender ?? update.user,
    recipient: update.recipient,
    body: update.body,
  };
}

function getMaxUserId(update: MaxUpdate, message: MaxMessage) {
  return message.sender?.user_id ?? update.user?.user_id;
}

function getMaxChatId(update: MaxUpdate, message: MaxMessage) {
  return (
    update.chat_id ??
    message.recipient?.chat_id ??
    message.recipient?.user_id ??
    getMaxUserId(update, message)
  );
}

function getMaxStartToken(update: MaxUpdate, message: MaxMessage) {
  return (
    update.payload ??
    update.start_payload ??
    readStartToken(message.body?.text)
  );
}

function findMaxContactAttachment(message: MaxMessage) {
  return message.body?.attachments?.find((attachment) => attachment.type === "contact");
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function handleMaxWebhook(update: MaxUpdate) {
  const message = getMaxMessage(update);
  const userId = getMaxUserId(update, message);
  const chatId = getMaxChatId(update, message);
  const startToken = getMaxStartToken(update, message);

  if (startToken && userId) {
    const result = await bindMessengerStart(
      MessengerAuthProvider.MAX,
      startToken,
      userId,
      chatId,
    );

    await sendMaxMessage(
      userId,
      "reason" in result
        ? (result.reason ?? "Не удалось начать подтверждение телефона")
        : "Нажмите кнопку ниже, чтобы подтвердить номер телефона для входа или регистрации в АлексФрут.",
      "reason" in result ? undefined : maxContactKeyboard(),
    );
    return;
  }

  if (update.update_type !== "message_created") {
    return;
  }

  const contactAttachment = findMaxContactAttachment(message);
  const payload = contactAttachment?.payload;

  if (!payload || !userId) {
    return;
  }

  const vcfInfo = getString(payload.vcf_info);
  const contactHash = getString(payload.hash);
  const contactPhone =
    getString(payload.phone) ??
    getString(payload.phone_number) ??
    getString(payload.tel);

  const result = await verifyMessengerContact({
    provider: MessengerAuthProvider.MAX,
    messengerUserId: userId,
    messengerChatId: chatId,
    contactPhone,
    maxVcfInfo: vcfInfo,
    maxContactHash: contactHash,
  });

  if ("reason" in result) {
    await sendMaxMessage(userId, result.reason);
    return;
  }

  const returnUrl = await getMessengerPhoneAuthReturnUrl(result.challengeId);

  await sendMaxMessage(
    userId,
    "Телефон подтверждён. Вернитесь в приложение, чтобы продолжить автоматически.",
    maxReturnKeyboard(returnUrl),
  );
}
