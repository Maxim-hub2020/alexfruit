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

function configureWebPush() {
  if (isConfigured) {
    return true;
  }

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject =
    process.env.WEB_PUSH_SUBJECT ||
    process.env.APP_URL ||
    "mailto:admin@alexfrut.local";

  if (!publicKey || !privateKey) {
    return false;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  isConfigured = true;
  return true;
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
  return process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";
}

export function isWebPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY,
  );
}

export async function sendPushForNotification(notification: PushNotificationRecord) {
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
}

export async function sendPushForNotifications(
  notifications: PushNotificationRecord[],
) {
  await Promise.allSettled(
    notifications.map((notification) => sendPushForNotification(notification)),
  );
}
