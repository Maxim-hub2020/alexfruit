import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import {
  MessengerAuthProvider,
  MessengerAuthStatus,
} from "@/generated/prisma";
import { ApiError } from "@/lib/api";
import {
  createSession,
  normalizeRussianPhone,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  messengerAuthCompleteSchema,
  messengerAuthStartSchema,
} from "@/lib/validators";

const messengerAuthTtlMs = 30 * 60 * 1000;
const phoneRegex = /^\+7\d{10}$/;

type ContactVerificationResult =
  | { ok: true; challengeId: string; phone: string }
  | { ok: false; reason: string };

type MessengerContactInput = {
  provider: MessengerAuthProvider;
  messengerUserId?: string | number | null;
  messengerChatId?: string | number | null;
  contactPhone?: string | null;
  telegramContactUserId?: string | number | null;
  maxVcfInfo?: string | null;
  maxContactHash?: string | null;
};

function getProvider(value: "TELEGRAM" | "MAX") {
  return value === "MAX" ? MessengerAuthProvider.MAX : MessengerAuthProvider.TELEGRAM;
}

function createToken() {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizePhoneOrThrow(value: string) {
  const phone = normalizeRussianPhone(value);

  if (!phoneRegex.test(phone)) {
    throw new ApiError("Укажите телефон в формате +7XXXXXXXXXX", 400);
  }

  return phone;
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ApiError(`Не настроена переменная ${name}`, 500);
  }

  return value;
}

function getTelegramBotUsername() {
  return requireEnv("TELEGRAM_BOT_USERNAME").replace(/^@/, "");
}

function getMaxBotLinkBase() {
  const explicitBase = process.env.MAX_BOT_DEEP_LINK_BASE?.trim();

  if (explicitBase) {
    return explicitBase;
  }

  const username = requireEnv("MAX_BOT_USERNAME").replace(/^@/, "");
  return `https://max.ru/${username}`;
}

function getAppBaseUrl() {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://alexfruit.ru"
  ).replace(/\/$/, "");
}

function createMessengerReturnUrl(challengeId: string) {
  const url = new URL("/auth/messenger-return", `${getAppBaseUrl()}/`);
  url.searchParams.set("messengerChallengeId", challengeId);
  return url.toString();
}

function appendStartPayload(base: string, token: string) {
  const normalizedBase = /^https?:\/\//i.test(base)
    ? base
    : `https://max.ru/${base.replace(/^@/, "")}`;
  const url = new URL(normalizedBase);
  url.searchParams.set("start", token);
  return url.toString();
}

function createTelegramAppLink(token: string) {
  const username = getTelegramBotUsername();
  return `tg://resolve?domain=${encodeURIComponent(username)}&start=${encodeURIComponent(token)}`;
}

function createDeepLink(provider: MessengerAuthProvider, token: string) {
  if (provider === MessengerAuthProvider.TELEGRAM) {
    return `https://t.me/${getTelegramBotUsername()}?start=${encodeURIComponent(token)}`;
  }

  return appendStartPayload(getMaxBotLinkBase(), token);
}

function toMessengerId(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeVcfInfo(value: string) {
  return value.replace(/\\r\\n/g, "\r\n").replace(/\\n/g, "\n");
}

function extractPhoneFromVcf(vcfInfo: string) {
  const match = vcfInfo.match(/TEL[^:]*:([+\d\s().-]+)/i);
  return match?.[1] ? normalizeRussianPhone(match[1]) : null;
}

function verifyMaxContactHash(vcfInfo: string, contactHash: string) {
  const token = process.env.MAX_BOT_TOKEN?.trim();

  if (!token) {
    return false;
  }

  const normalizedVcf = normalizeVcfInfo(vcfInfo);
  const digest = createHmac("sha256", token).update(normalizedVcf).digest();
  const hex = digest.toString("hex");
  const base64 = digest.toString("base64");

  return safeEqualText(contactHash, hex) || safeEqualText(contactHash, base64);
}

export async function startMessengerPhoneAuth(input: unknown) {
  const data = messengerAuthStartSchema.parse(input);
  const provider = getProvider(data.provider);
  const phone = normalizePhoneOrThrow(data.phone);
  const token = createToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + messengerAuthTtlMs);
  const deepLink = createDeepLink(provider, token);

  const challenge = await prisma.messengerAuthChallenge.create({
    data: {
      provider,
      phone,
      tokenHash,
      expiresAt,
    },
  });

  return {
    id: challenge.id,
    provider: challenge.provider,
    phone: challenge.phone,
    status: challenge.status,
    expiresAt: challenge.expiresAt.toISOString(),
    deepLink,
    appLink:
      provider === MessengerAuthProvider.TELEGRAM
        ? createTelegramAppLink(token)
        : null,
    startCommand:
      provider === MessengerAuthProvider.TELEGRAM
        ? `/start ${token}`
        : null,
  };
}

export async function getMessengerPhoneAuthStatus(id: string) {
  const challenge = await prisma.messengerAuthChallenge.findUnique({
    where: { id },
    select: {
      id: true,
      provider: true,
      phone: true,
      status: true,
      expiresAt: true,
      verifiedAt: true,
    },
  });

  if (!challenge) {
    throw new ApiError("Попытка входа не найдена", 404);
  }

  if (
    challenge.status === MessengerAuthStatus.PENDING &&
    challenge.expiresAt.getTime() <= Date.now()
  ) {
    const expired = await prisma.messengerAuthChallenge.update({
      where: { id },
      data: { status: MessengerAuthStatus.EXPIRED },
      select: {
        id: true,
        provider: true,
        phone: true,
        status: true,
        expiresAt: true,
        verifiedAt: true,
      },
    });

    return {
      ...expired,
      phone: null,
      expiresAt: expired.expiresAt.toISOString(),
      verifiedAt: expired.verifiedAt?.toISOString() ?? null,
    };
  }

  return {
    ...challenge,
    phone: challenge.status === MessengerAuthStatus.VERIFIED ? challenge.phone : null,
    expiresAt: challenge.expiresAt.toISOString(),
    verifiedAt: challenge.verifiedAt?.toISOString() ?? null,
  };
}

export async function getMessengerPhoneAuthReturnUrl(id: string) {
  return createMessengerReturnUrl(id);
}

export async function completeMessengerPhoneAuth(input: unknown) {
  const data = messengerAuthCompleteSchema.parse(input);
  const now = new Date();

  const user = await prisma.$transaction(async (tx) => {
    const challenge = await tx.messengerAuthChallenge.findUnique({
      where: { id: data.id },
    });

    if (!challenge) {
      throw new ApiError("Попытка входа не найдена", 404);
    }

    if (challenge.status !== MessengerAuthStatus.VERIFIED) {
      throw new ApiError("Телефон ещё не подтверждён в мессенджере", 409);
    }

    if (challenge.expiresAt <= now) {
      await tx.messengerAuthChallenge.update({
        where: { id: challenge.id },
        data: { status: MessengerAuthStatus.EXPIRED },
      });
      throw new ApiError("Время подтверждения истекло, начните вход заново", 410);
    }

    const existingUser = await tx.user.findUnique({
      where: { phone: challenge.phone },
    });

    if (!existingUser) {
      throw new ApiError("Аккаунт с этим телефоном не найден. Зарегистрируйтесь.", 404);
    }

    await tx.messengerAuthChallenge.update({
      where: { id: challenge.id },
      data: {
        status: MessengerAuthStatus.CONSUMED,
        userId: existingUser.id,
      },
    });

    return existingUser;
  });

  await createSession({
    userId: user.id,
    role: user.role,
    name: user.name,
  });

  return user;
}

export async function bindMessengerStart(
  provider: MessengerAuthProvider,
  rawToken: string,
  messengerUserId?: string | number | null,
  messengerChatId?: string | number | null,
) {
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const challenge = await prisma.messengerAuthChallenge.findUnique({
    where: { tokenHash },
  });

  if (!challenge || challenge.provider !== provider) {
    return { ok: false, reason: "Ссылка входа не найдена" };
  }

  if (challenge.status !== MessengerAuthStatus.PENDING) {
    return { ok: false, reason: "Эта ссылка входа уже использована" };
  }

  if (challenge.expiresAt <= now) {
    await prisma.messengerAuthChallenge.update({
      where: { id: challenge.id },
      data: { status: MessengerAuthStatus.EXPIRED },
    });
    return { ok: false, reason: "Ссылка входа устарела, начните вход заново" };
  }

  await prisma.messengerAuthChallenge.update({
    where: { id: challenge.id },
    data: {
      messengerUserId: toMessengerId(messengerUserId),
      messengerChatId: toMessengerId(messengerChatId ?? messengerUserId),
    },
  });

  return { ok: true, phone: challenge.phone };
}

export async function verifyMessengerContact({
  provider,
  messengerUserId,
  messengerChatId,
  contactPhone,
  telegramContactUserId,
  maxVcfInfo,
  maxContactHash,
}: MessengerContactInput): Promise<ContactVerificationResult> {
  const normalizedChatId = toMessengerId(messengerChatId ?? messengerUserId);
  const normalizedUserId = toMessengerId(messengerUserId);
  let normalizedPhone = contactPhone ? normalizeRussianPhone(contactPhone) : null;

  if (!normalizedChatId && !normalizedUserId) {
    return { ok: false, reason: "Не удалось определить чат мессенджера" };
  }

  if (provider === MessengerAuthProvider.TELEGRAM) {
    const contactUserId = toMessengerId(telegramContactUserId);

    if (!contactUserId || contactUserId !== normalizedUserId) {
      return { ok: false, reason: "Нужно отправить именно свой контакт Telegram" };
    }
  }

  if (provider === MessengerAuthProvider.MAX) {
    if (!maxVcfInfo || !maxContactHash) {
      return { ok: false, reason: "MAX не прислал проверочный hash контакта" };
    }

    if (!verifyMaxContactHash(maxVcfInfo, maxContactHash)) {
      return { ok: false, reason: "MAX не подтвердил принадлежность номера" };
    }

    normalizedPhone = normalizedPhone ?? extractPhoneFromVcf(maxVcfInfo);
  }

  if (!normalizedPhone || !phoneRegex.test(normalizedPhone)) {
    return { ok: false, reason: "Не удалось прочитать номер телефона" };
  }

  const challenge = await prisma.messengerAuthChallenge.findFirst({
    where: {
      provider,
      status: MessengerAuthStatus.PENDING,
      OR: [
        ...(normalizedChatId ? [{ messengerChatId: normalizedChatId }] : []),
        ...(normalizedUserId ? [{ messengerUserId: normalizedUserId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    return { ok: false, reason: "Активный вход для этого чата не найден" };
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    await prisma.messengerAuthChallenge.update({
      where: { id: challenge.id },
      data: { status: MessengerAuthStatus.EXPIRED },
    });
    return { ok: false, reason: "Время подтверждения истекло" };
  }

  if (challenge.phone !== normalizedPhone) {
    await prisma.messengerAuthChallenge.update({
      where: { id: challenge.id },
      data: {
        status: MessengerAuthStatus.FAILED,
        contactPhone: normalizedPhone,
      },
    });
    return {
      ok: false,
      reason: "Номер контакта не совпадает с номером, указанным на сайте",
    };
  }

  await prisma.messengerAuthChallenge.update({
    where: { id: challenge.id },
    data: {
      status: MessengerAuthStatus.VERIFIED,
      contactPhone: normalizedPhone,
      verifiedAt: new Date(),
    },
  });

  return { ok: true, challengeId: challenge.id, phone: normalizedPhone };
}
