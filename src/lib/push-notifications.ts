import webPush from "web-push";
import { prisma } from "@/lib/db";

type PushNotificationRecord = {
  id: string;
  userId: string;
  orderId?: string | null;
  type: string;
  title: string;
  message: string;
};

type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

let isConfigured = false;
const PUSH_TIMEOUT_MS = 15_000;
const PUSH_TTL_SECONDS = 60 * 60;
const VAPID_PUBLIC_KEY_BYTES = 65;

function decodeBase64Url(value: string) {
  try {
    const normalized = value.trim().replace(/\s+/g, "");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const base64 = `${normalized}${padding}`.replace(/-/g, "+").replace(/_/g, "/");

    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
}

function getVapidPublicKeyError(publicKey: string | undefined) {
  if (!publicKey) {
    return "NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY is empty";
  }

  const decoded = decodeBase64Url(publicKey);

  if (!decoded || decoded.length !== VAPID_PUBLIC_KEY_BYTES) {
    return `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY must decode to ${VAPID_PUBLIC_KEY_BYTES} bytes`;
  }

  return null;
}

function configureWebPush() {
  if (isConfigured) {
    return true;
  }

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject =
    process.env.WEB_PUSH_SUBJECT ||
    process.env.APP_URL ||
    "mailto:info@alexfruit.ru";

  if (!publicKey || !privateKey) {
    return false;
  }

  const publicKeyError = getVapidPublicKeyError(publicKey);

  if (publicKeyError) {
    console.warn("Push notifications are not configured correctly", {
      publicKeyError,
    });
    return false;
  }

  try {
    webPush.setVapidDetails(subject, publicKey, privateKey);
    isConfigured = true;
    return true;
  } catch (error) {
    console.warn("Push notifications are not configured correctly", {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function getNotificationUrl(notification: PushNotificationRecord) {
  if (notification.orderId) {
    return "/orders";
  }

  return "/profile";
}

function stringifyPushPayload(payload: Record<string, unknown>) {
  return JSON.stringify(payload).replace(/[^\x00-\x7F]/g, (character) => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

function toWebPushSubscription(subscription: PushSubscriptionRecord) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

function isExpiredSubscriptionError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error.statusCode === 404 || error.statusCode === 410)
  );
}

function getPushErrorDetails(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { message: String(error) };
  }

  const details = error as {
    message?: string;
    statusCode?: number;
    body?: string;
  };

  return {
    message: details.message,
    statusCode: details.statusCode,
    body: details.body,
  };
}

export function getWebPushPublicKey() {
  return process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim() ?? "";
}

export function isWebPushConfigured() {
  const publicKey = getWebPushPublicKey();

  return Boolean(
    publicKey &&
      process.env.WEB_PUSH_PRIVATE_KEY &&
      !getVapidPublicKeyError(publicKey),
  );
}

export async function sendPushForNotification(notification: PushNotificationRecord) {
  try {
    if (!configureWebPush()) {
      return;
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: notification.userId },
      select: {
        endpoint: true,
        p256dh: true,
        auth: true,
      },
    });

    if (subscriptions.length === 0) {
      return;
    }

    const payload = stringifyPushPayload({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      orderId: notification.orderId ?? null,
      url: getNotificationUrl(notification),
    });

    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(toWebPushSubscription(subscription), payload, {
            TTL: PUSH_TTL_SECONDS,
            timeout: PUSH_TIMEOUT_MS,
          });
        } catch (error) {
          if (isExpiredSubscriptionError(error)) {
            await prisma.pushSubscription.deleteMany({
              where: { endpoint: subscription.endpoint },
            });
            return;
          }

          console.warn(
            "Не удалось отправить push-уведомление",
            getPushErrorDetails(error),
          );
        }
      }),
    );
  } catch (error) {
    console.warn("Push notification dispatch failed", {
      message: error instanceof Error ? error.message : String(error),
      notificationId: notification.id,
    });
  }
}

export async function sendPushForNotifications(
  notifications: PushNotificationRecord[],
) {
  await Promise.allSettled(
    notifications.map((notification) => sendPushForNotification(notification)),
  );
}
