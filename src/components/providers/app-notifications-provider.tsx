"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";

type AppNotification = {
  id: string;
  orderId: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

type WebPushStatus =
  | "idle"
  | "subscribing"
  | "ready"
  | "needs-action"
  | "failed"
  | "unsupported";

type WebPushSubscriptionResult = {
  ok: boolean;
  status?: WebPushStatus;
  message?: string;
};

type EnsureWebPushOptions = {
  allowCreate: boolean;
};

const LAST_SEEN_KEY = "alexfrut-notifications-last-seen-at";
const PERMISSION_DISMISSED_KEY = "alexfrut-notifications-permission-dismissed";
const IOS_INSTALL_DISMISSED_KEY = "alexfrut-ios-install-dismissed";
const POLL_INTERVAL_MS = 12_000;
const SILENT_PUSH_RETRY_INTERVAL_MS = 60_000;
const TOAST_LIFETIME_MS = 8_000;

function readLastSeenAt() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(LAST_SEEN_KEY);
}

function saveLastSeenAt(value: string) {
  window.localStorage.setItem(LAST_SEEN_KEY, value);
}

function getLatestCreatedAt(notifications: AppNotification[]) {
  return notifications.reduce<string | null>((latest, notification) => {
    if (!latest || notification.createdAt > latest) {
      return notification.createdAt;
    }

    return latest;
  }, null);
}

function canUseBrowserNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

function canUseWebPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    window.isSecureContext
  );
}

function isIosDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform;

  return (
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
  );
}

function isStandaloneWebApp() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function shouldShowIosInstallPrompt() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    isIosDevice() &&
    !isStandaloneWebApp() &&
    !window.sessionStorage.getItem(IOS_INSTALL_DISMISSED_KEY)
  );
}

function getUnsupportedWebPushMessage() {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Push-уведомления работают только на HTTPS-домене или на localhost.";
  }

  if (isIosDevice() && !isStandaloneWebApp()) {
    return "На iPhone пуши работают только в приложении, добавленном на экран «Домой». Откройте АлексФрут с иконки и нажмите «Включить».";
  }

  return "Этот браузер не поддерживает фоновые push-уведомления.";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function getBrowserErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "iPhone не дал создать подписку. Откройте АлексФрут с иконки на экране «Домой», приложение попробует подключить уведомления автоматически.";
    }

    if (error.name === "InvalidAccessError") {
      return "Браузер отклонил ключ push-подписки. Приложение попробует подключить уведомления автоматически.";
    }

    if (error.name === "AbortError") {
      return "Браузер прервал создание push-подписки. Проверьте интернет, приложение попробует подключиться автоматически.";
    }

    return `${error.name}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось создать push-подписку. Проверьте интернет, приложение попробует подключиться автоматически.";
}

async function getWebPushPublicKey() {
  const response = await fetch("/api/push/config", { cache: "no-store" });

  if (!response.ok) {
    return "";
  }

  const data = await response.json();
  return data.enabled && typeof data.publicKey === "string" ? data.publicKey : "";
}

async function saveWebPushSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    return {
      ok: false,
      status: "failed" as const,
      message:
        typeof data?.error === "string"
          ? data.error
          : "Сервер не смог сохранить push-подписку.",
    };
  }

  return { ok: true, status: "ready" as const };
}

async function ensureWebPushSubscription({
  allowCreate,
}: EnsureWebPushOptions): Promise<WebPushSubscriptionResult> {
  if (!canUseWebPush()) {
    return {
      ok: false,
      status: "unsupported",
      message: getUnsupportedWebPushMessage(),
    };
  }

  if (isIosDevice() && !isStandaloneWebApp()) {
    return {
      ok: false,
      status: "unsupported",
      message: getUnsupportedWebPushMessage(),
    };
  }

  const publicKey = await getWebPushPublicKey();

  if (!publicKey) {
    return {
      ok: false,
      status: "failed",
      message: "На сервере ещё не настроены ключи push-уведомлений или пользователь не авторизован.",
    };
  }

  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const readyRegistration = await navigator.serviceWorker.ready;
    await readyRegistration.update().catch(() => undefined);

    const existingSubscription = await readyRegistration.pushManager.getSubscription();

    if (existingSubscription?.endpoint) {
      return saveWebPushSubscription(existingSubscription);
    }

    if (!allowCreate) {
      return {
        ok: false,
        status: "needs-action",
        message:
          "Разрешение уже есть. Приложение попробует создать push-подписку именно с этого устройства автоматически.",
      };
    }

    const subscription = await readyRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    if (!subscription.endpoint) {
      return {
        ok: false,
        status: "failed",
        message: "Браузер разрешил пуши, но не выдал адрес подписки.",
      };
    }

    return saveWebPushSubscription(subscription);
  } catch (error) {
    console.warn("Не удалось создать push-подписку", error);

    return {
      ok: false,
      status: "failed",
      message: getBrowserErrorMessage(error),
    };
  }
}

export function AppNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [showIosInstallPrompt, setShowIosInstallPrompt] = useState(false);
  const [browserPushSupported, setBrowserPushSupported] = useState(false);
  const [webPushStatus, setWebPushStatus] = useState<WebPushStatus>("idle");
  const isMountedRef = useRef(false);
  const skipNextGrantedAutoSubscribeRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    const frameId = window.requestAnimationFrame(() => {
      if (!isMountedRef.current) {
        return;
      }

      const hasWebPush = canUseWebPush();
      const shouldInstallOnIos = shouldShowIosInstallPrompt();

      setBrowserPushSupported(hasWebPush);
      setShowIosInstallPrompt(shouldInstallOnIos);

      if (canUseBrowserNotifications()) {
        setPermission(window.Notification.permission);
        setShowPermissionPrompt(
          !shouldInstallOnIos &&
            window.Notification.permission === "default" &&
            hasWebPush &&
            !window.sessionStorage.getItem(PERMISSION_DISMISSED_KEY),
        );
      }
    });

    return () => {
      isMountedRef.current = false;
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (permission !== "granted") {
      return;
    }

    if (skipNextGrantedAutoSubscribeRef.current) {
      skipNextGrantedAutoSubscribeRef.current = false;
      return;
    }

    setWebPushStatus("subscribing");
    ensureWebPushSubscription({ allowCreate: !isIosDevice() })
      .then((result) => {
        if (isMountedRef.current) {
          setWebPushStatus(result.ok ? "ready" : result.status ?? "failed");
        }
      })
      .catch(() => {
        if (isMountedRef.current) {
          setWebPushStatus("failed");
        }
      });
  }, [permission]);

  useEffect(() => {
    if (
      permission !== "granted" ||
      !browserPushSupported ||
      webPushStatus === "ready" ||
      webPushStatus === "subscribing" ||
      webPushStatus === "unsupported"
    ) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const result = await ensureWebPushSubscription({ allowCreate: true });

      if (!isMountedRef.current) {
        return;
      }

      setWebPushStatus(result.ok ? "ready" : result.status ?? "failed");
    }, SILENT_PUSH_RETRY_INTERVAL_MS);

    return () => window.clearTimeout(timeoutId);
  }, [browserPushSupported, permission, webPushStatus]);

  useEffect(() => {
    const timeouts: number[] = [];

    async function checkNotifications() {
      try {
        function maybeShowPermissionPrompt() {
          if (shouldShowIosInstallPrompt()) {
            setShowIosInstallPrompt(true);
            return;
          }

          if (
            canUseBrowserNotifications() &&
            canUseWebPush() &&
            window.Notification.permission === "default" &&
            !window.sessionStorage.getItem(PERMISSION_DISMISSED_KEY)
          ) {
            setShowPermissionPrompt(true);
          }
        }

        const response = await fetch("/api/notifications?limit=12", {
          cache: "no-store",
        });

        if (!isMountedRef.current || response.status === 401) {
          return;
        }

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const notifications = Array.isArray(data.notifications)
          ? (data.notifications as AppNotification[])
          : [];
        const latestCreatedAt = getLatestCreatedAt(notifications);

        if (!latestCreatedAt) {
          return;
        }

        const lastSeenAt = readLastSeenAt();

        if (!lastSeenAt) {
          saveLastSeenAt(latestCreatedAt);
          maybeShowPermissionPrompt();
          return;
        }

        const freshNotifications = notifications
          .filter((notification) => notification.createdAt > lastSeenAt)
          .slice(0, 4)
          .slice()
          .reverse();

        if (freshNotifications.length > 0) {
          setToasts((current) => {
            const currentIds = new Set(current.map((notification) => notification.id));
            return [
              ...current,
              ...freshNotifications.filter((notification) => !currentIds.has(notification.id)),
            ].slice(-4);
          });

          freshNotifications.forEach((notification) => {
            const timeoutId = window.setTimeout(() => {
              setToasts((current) =>
                current.filter((toast) => toast.id !== notification.id),
              );
            }, TOAST_LIFETIME_MS);
            timeouts.push(timeoutId);
          });
        }

        saveLastSeenAt(latestCreatedAt);
        maybeShowPermissionPrompt();
      } catch {
        // Push notifications are helpful, but the app should stay quiet if polling fails.
      }
    }

    checkNotifications();
    const intervalId = window.setInterval(checkNotifications, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  async function requestBrowserPermission() {
    if (!canUseBrowserNotifications()) {
      setPermission("unsupported");
      setShowPermissionPrompt(false);
      setWebPushStatus("unsupported");
      return;
    }

    if (isIosDevice() && !isStandaloneWebApp()) {
      setShowIosInstallPrompt(true);
      setShowPermissionPrompt(false);
      setWebPushStatus("unsupported");
      return;
    }

    const result = await window.Notification.requestPermission();

    if (result === "granted") {
      skipNextGrantedAutoSubscribeRef.current = true;
      setPermission(result);
      setWebPushStatus("subscribing");
      const subscriptionResult = await ensureWebPushSubscription({ allowCreate: true });
      setWebPushStatus(subscriptionResult.ok ? "ready" : subscriptionResult.status ?? "failed");
    }

    if (result === "denied") {
      setPermission(result);
      setWebPushStatus("failed");
    }

    if (result === "default") {
      setPermission(result);
    }

    setShowPermissionPrompt(false);
  }

  function dismissPermissionPrompt() {
    window.sessionStorage.setItem(PERMISSION_DISMISSED_KEY, "1");
    setShowPermissionPrompt(false);
  }

  function dismissIosInstallPrompt() {
    window.sessionStorage.setItem(IOS_INSTALL_DISMISSED_KEY, "1");
    setShowIosInstallPrompt(false);
  }

  const showPushSetupNotice =
    showIosInstallPrompt || (showPermissionPrompt && permission === "default");
  const isIosInstallNotice = showIosInstallPrompt;
  const pushSetupTitle = isIosInstallNotice
    ? "Как подключить уведомления на iPhone"
    : "Включить уведомления";
  const pushSetupMessage = isIosInstallNotice
    ? "На iPhone уведомления работают только из приложения на экране «Домой»: нажмите «Поделиться», выберите «На экран Домой», откройте АлексФрут с иконки и нажмите «Включить уведомления»."
    : "На Android и в браузере нажмите «Включить». На iPhone сначала добавьте сайт на экран «Домой».";

  return (
    <>
      {children}

      <div className="pointer-events-none fixed inset-x-3 bottom-24 z-[80] flex flex-col items-end gap-3 md:inset-x-auto md:right-5 md:top-24 md:bottom-auto">
        {showPushSetupNotice ? (
          <div className="pointer-events-auto w-full max-w-sm rounded-[1.5rem] border border-white/70 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <Bell size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{pushSetupTitle}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  {pushSetupMessage}
                </p>
                <div className="mt-3 flex gap-2">
                  {permission === "default" ? (
                    <button
                      type="button"
                      onClick={requestBrowserPermission}
                      className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Включить
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={
                      isIosInstallNotice ? dismissIosInstallPrompt : dismissPermissionPrompt
                    }
                    className="rounded-full bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--muted)]"
                  >
                    Понятно
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {toasts.map((notification) => (
          <article
            key={notification.id}
            className="animate-notification-toast pointer-events-auto w-full max-w-sm rounded-[1.5rem] border border-white/70 bg-white/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-900">
                <Bell size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{notification.title}</p>
                <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">
                  {notification.message}
                </p>
              </div>
              <button
                type="button"
                aria-label="Закрыть уведомление"
                onClick={() =>
                  setToasts((current) =>
                    current.filter((toast) => toast.id !== notification.id),
                  )
                }
                className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
              >
                <X size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
