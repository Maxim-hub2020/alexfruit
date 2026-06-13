export type MessengerProvider = "TELEGRAM" | "MAX";
export type MessengerMode = "login" | "register";
export type MessengerDisplayMode = "standalone" | "browser";

export type MessengerLaunchChallenge = {
  id: string;
  provider: MessengerProvider;
  phone: string;
};

type MessengerLaunchContext = MessengerLaunchChallenge & {
  mode: MessengerMode;
  displayMode: MessengerDisplayMode;
  createdAt: number;
};

export const messengerChallengeStorageKey = "alexfruit.messenger-auth-challenge";
export const messengerReturnWrongContextMessage =
  "Телефон подтверждён. Откройте веб-приложение АлексФрут — вход завершится там автоматически.";

const messengerLaunchContextStorageKey = "alexfruit.messenger-auth-launch-context";
const messengerLaunchContextMaxAgeMs = 20 * 60 * 1000;

function isBrowser() {
  return typeof window !== "undefined";
}

export function getCurrentDisplayMode(): MessengerDisplayMode {
  if (!isBrowser()) {
    return "browser";
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return navigatorWithStandalone.standalone ||
    window.matchMedia("(display-mode: standalone)").matches
    ? "standalone"
    : "browser";
}

function parseLaunchContext(value: string | null): MessengerLaunchContext | null {
  if (!value) {
    return null;
  }

  try {
    const context = JSON.parse(value) as Partial<MessengerLaunchContext>;

    if (
      typeof context.id === "string" &&
      typeof context.phone === "string" &&
      (context.provider === "TELEGRAM" || context.provider === "MAX") &&
      (context.mode === "login" || context.mode === "register") &&
      (context.displayMode === "standalone" || context.displayMode === "browser") &&
      typeof context.createdAt === "number"
    ) {
      return context as MessengerLaunchContext;
    }
  } catch {
    // Broken local data should never block a fresh verification attempt.
  }

  return null;
}

export function rememberMessengerLaunchContext(
  challenge: MessengerLaunchChallenge,
  mode: MessengerMode,
) {
  if (!isBrowser()) {
    return;
  }

  const context: MessengerLaunchContext = {
    ...challenge,
    mode,
    displayMode: getCurrentDisplayMode(),
    createdAt: Date.now(),
  };

  try {
    window.localStorage.setItem(
      messengerLaunchContextStorageKey,
      JSON.stringify(context),
    );
  } catch {
    // Private browsing/storage restrictions should not break messenger auth.
  }
}

export function readMessengerLaunchContext(id: string) {
  if (!isBrowser()) {
    return null;
  }

  let context: MessengerLaunchContext | null = null;

  try {
    context = parseLaunchContext(
      window.localStorage.getItem(messengerLaunchContextStorageKey),
    );
  } catch {
    context = null;
  }

  if (!context || context.id !== id) {
    return null;
  }

  if (Date.now() - context.createdAt > messengerLaunchContextMaxAgeMs) {
    clearMessengerLaunchContext(id);
    return null;
  }

  return context;
}

export function canCompleteMessengerReturn(id: string) {
  const context = readMessengerLaunchContext(id);

  if (!context) {
    return false;
  }

  return context.displayMode === getCurrentDisplayMode();
}

export function clearMessengerLaunchContext(id?: string) {
  if (!isBrowser()) {
    return;
  }

  try {
    const context = parseLaunchContext(
      window.localStorage.getItem(messengerLaunchContextStorageKey),
    );

    if (!id || context?.id === id) {
      window.localStorage.removeItem(messengerLaunchContextStorageKey);
    }
  } catch {
    // Nothing useful to recover here.
  }
}
