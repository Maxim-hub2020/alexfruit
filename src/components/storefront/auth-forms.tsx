"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from "react";
import { Button } from "@/components/ui/button";

function getRedirectByRole(role: string) {
  if (role === "ADMIN") {
    return "/admin";
  }

  if (role === "COURIER") {
    return "/courier";
  }

  if (role === "PICKER") {
    return "/picker";
  }

  return "/";
}

function getRussianPhoneDigits(value: string) {
  let digits = value.replace(/\D/g, "");

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

function canEditPhone(event: KeyboardEvent<HTMLInputElement>) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return true;
  }

  return [
    "Backspace",
    "Delete",
    "ArrowLeft",
    "ArrowRight",
    "Tab",
    "Home",
    "End",
  ].includes(event.key);
}

function PhoneDigitsInput({
  value,
  onChange,
  autoComplete = "tel-national",
  id,
  inputRef,
  name = "phone",
  placeholder = "9991234567",
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  id?: string;
  inputRef?: Ref<HTMLInputElement>;
  name?: string;
  placeholder?: string;
}) {
  function updatePhoneDigits(rawValue: string) {
    onChange(getRussianPhoneDigits(rawValue));
  }

  return (
    <div className="flex h-12 overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--line)] focus-within:ring-[var(--accent-soft)]">
      <span className="flex shrink-0 items-center border-r border-[var(--line)] px-4 font-semibold text-[var(--foreground)]">
        +7
      </span>
      <input
        ref={inputRef}
        id={id}
        name={name}
        value={value}
        onInput={(event) => updatePhoneDigits(event.currentTarget.value)}
        onChange={(event) => updatePhoneDigits(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (canEditPhone(event)) {
            return;
          }

          if (!/^\d$/.test(event.key)) {
            event.preventDefault();
            return;
          }

          const input = event.currentTarget;
          const hasSelection = input.selectionStart !== input.selectionEnd;

          if (value.length >= 10 && !hasSelection) {
            event.preventDefault();
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          updatePhoneDigits(event.clipboardData.getData("text"));
        }}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-4 outline-none"
      />
    </div>
  );
}

type MessengerProvider = "TELEGRAM" | "MAX";

type MessengerStatusResponse = {
  id: string;
  provider: MessengerProvider;
  phone?: string | null;
  status: string;
  expiresAt: string;
  verifiedAt?: string | null;
};

type MessengerChallenge = {
  id: string;
  provider: MessengerProvider;
  phone: string;
  deepLink: string;
  appLink?: string | null;
  startCommand?: string | null;
  status: string;
  expiresAt: string;
};

type VerifiedMessengerChallenge = {
  id: string;
  phoneDigits: string;
  provider: MessengerProvider;
};

type MessengerAuthPanelProps = {
  phoneDigits: string;
  mode?: "login" | "register";
  onVerified?: (challenge: VerifiedMessengerChallenge) => void;
  providers?: readonly MessengerProvider[];
};

const messengerProviderLabels: Record<MessengerProvider, string> = {
  TELEGRAM: "Telegram",
  MAX: "MAX",
};

const defaultMessengerProviders = ["MAX"] as const;
const messengerChallengeStorageKey = "alexfruit.messenger-auth-challenge";

function MaxMessengerIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="maxMessengerIconGradient" x1="7" y1="7" x2="41" y2="41">
          <stop offset="0" stopColor="#1EC8FF" />
          <stop offset="0.52" stopColor="#236BFF" />
          <stop offset="1" stopColor="#8F3BFF" />
        </linearGradient>
      </defs>
      <path
        fill="url(#maxMessengerIconGradient)"
        d="M24 5C13.5 5 5 12.7 5 22.3c0 5.8 3.1 10.9 7.9 14.1L9.8 43c-.4.9.6 1.8 1.5 1.3l7.2-4.2c1.8.5 3.6.8 5.5.8 10.5 0 19-7.7 19-17.3S34.5 5 24 5Z"
      />
      <path
        fill="white"
        fillOpacity="0.96"
        d="M15.7 24.2c0-4.8 3.8-8.5 8.9-8.5 4.9 0 8.2 3.2 8.2 7.6 0 4.8-3.7 8.4-8.9 8.4-5 0-8.2-3.1-8.2-7.5Zm8.6 3.1c2.2 0 3.9-1.7 3.9-3.8 0-2-1.4-3.3-3.5-3.3-2.3 0-4 1.7-4 3.8 0 2 1.4 3.3 3.6 3.3Z"
      />
    </svg>
  );
}

async function fetchMessengerStatus(id: string) {
  const response = await fetch(`/api/auth/messenger/status/${id}`, {
    cache: "no-store",
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error ?? "Не удалось проверить подтверждение телефона");
  }

  return result as MessengerStatusResponse;
}

function clearMessengerReturnParam() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("messengerChallengeId");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function isAppleMobileDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };
  const userAgent = navigatorWithStandalone.userAgent;

  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigatorWithStandalone.platform === "MacIntel" &&
      navigatorWithStandalone.maxTouchPoints > 1)
  );
}

function shouldUseSameWindowDeepLink(provider: MessengerProvider) {
  return provider === "TELEGRAM" && isAppleMobileDevice();
}

function getMessengerLaunchLink(challenge: MessengerChallenge) {
  if (
    challenge.provider === "TELEGRAM" &&
    challenge.appLink &&
    isAppleMobileDevice()
  ) {
    return challenge.appLink;
  }

  return challenge.deepLink;
}

function MessengerAuthPanel({
  phoneDigits,
  mode = "login",
  onVerified,
  providers = defaultMessengerProviders,
}: MessengerAuthPanelProps) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<MessengerChallenge | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<MessengerProvider | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const onVerifiedRef = useRef(onVerified);

  useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);

  useEffect(() => {
    if (challenge) {
      window.sessionStorage.setItem(
        messengerChallengeStorageKey,
        JSON.stringify(challenge),
      );
      return;
    }

    window.sessionStorage.removeItem(messengerChallengeStorageKey);
  }, [challenge]);

  useEffect(() => {
    if (!challenge?.id) {
      return;
    }

    let cancelled = false;
    let completed = false;

    async function pollStatus() {
      if (!challenge?.id || completed) {
        return;
      }

      const response = await fetch(`/api/auth/messenger/status/${challenge.id}`, {
        cache: "no-store",
      });
      const result = await response.json();

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setError(result.error ?? "Не удалось проверить подтверждение телефона");
        return;
      }

      if (result.status === "VERIFIED") {
        completed = true;
        window.sessionStorage.removeItem(messengerChallengeStorageKey);

        if (mode === "register") {
          setError("");
          setMessage("Телефон подтверждён. Теперь задайте пароль и создайте аккаунт.");
          onVerifiedRef.current?.({
            id: challenge.id,
            phoneDigits,
            provider: challenge.provider,
          });
          return;
        }

        setIsCompleting(true);
        setMessage("Телефон подтверждён. Входим в приложение...");

        const completeResponse = await fetch("/api/auth/messenger/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: challenge.id }),
        });
        const completeResult = await completeResponse.json();

        if (cancelled) {
          return;
        }

        setIsCompleting(false);

        if (!completeResponse.ok) {
          setError(completeResult.error ?? "Не удалось завершить вход");
          return;
        }

        router.push(getRedirectByRole(completeResult.role));
        router.refresh();
        return;
      }

      if (result.status === "EXPIRED" || result.status === "FAILED") {
        setChallenge(null);
        setCopiedCommand(false);
        setMessage("");
        setError(
          result.status === "EXPIRED"
            ? "Время подтверждения истекло. Запустите вход ещё раз."
            : "Подтверждение не прошло. Проверьте номер и попробуйте заново.",
        );
      }
    }

    void pollStatus();
    const intervalId = window.setInterval(() => {
      void pollStatus();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [challenge, mode, phoneDigits, router]);

  function openMessengerChallenge(nextChallenge: MessengerChallenge) {
    const launchLink = getMessengerLaunchLink(nextChallenge);

    window.sessionStorage.setItem(
      messengerChallengeStorageKey,
      JSON.stringify(nextChallenge),
    );
    setMessage(
      `Откройте ${messengerProviderLabels[nextChallenge.provider]}, нажмите «Поделиться телефоном». После подтверждения бот отправит ссылку возврата в приложение.`,
    );

    if (shouldUseSameWindowDeepLink(nextChallenge.provider)) {
      window.location.assign(launchLink);
      return;
    }

    const popup = window.open(launchLink, "_blank", "noopener,noreferrer");

    if (!popup) {
      setMessage(
        `Браузер заблокировал открытие ${messengerProviderLabels[nextChallenge.provider]}. Откройте ссылку ниже вручную.`,
      );
    }
  }

  async function copyStartCommand() {
    if (!challenge?.startCommand) {
      return;
    }

    try {
      await navigator.clipboard.writeText(challenge.startCommand);
      setCopiedCommand(true);
      setError("");
      setMessage("Команда скопирована. Вставьте её в чат с ботом Telegram после включения VPN.");
    } catch {
      setCopiedCommand(false);
      setError("Не удалось скопировать команду. Выделите её вручную и отправьте боту.");
    }
  }

  function readStoredChallenge(provider: MessengerProvider) {
    const savedChallenge = window.sessionStorage.getItem(messengerChallengeStorageKey);

    if (!savedChallenge) {
      return null;
    }

    try {
      const restoredChallenge = JSON.parse(savedChallenge) as MessengerChallenge;

      if (
        restoredChallenge.provider === provider &&
        restoredChallenge.phone === `+7${phoneDigits}` &&
        providers.includes(restoredChallenge.provider)
      ) {
        return restoredChallenge;
      }
    } catch {
      // Broken session data should not block a fresh messenger challenge.
    }

    window.sessionStorage.removeItem(messengerChallengeStorageKey);
    return null;
  }

  async function startMessenger(provider: MessengerProvider) {
    setError("");
    setMessage("");
    setCopiedCommand(false);

    if (phoneDigits.length !== 10) {
      setError("Укажите 10 цифр телефона после +7.");
      return;
    }

    if (
      challenge?.provider === provider &&
      challenge.phone === `+7${phoneDigits}`
    ) {
      openMessengerChallenge(challenge);
      return;
    }

    const restoredChallenge = readStoredChallenge(provider);

    if (restoredChallenge) {
      setChallenge(restoredChallenge);
      setMessage(
        `Подтверждение уже создано. Откройте ${messengerProviderLabels[restoredChallenge.provider]} повторно.`,
      );
      openMessengerChallenge(restoredChallenge);
      return;
    }

    setLoadingProvider(provider);

    const response = await fetch("/api/auth/messenger/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, phone: `+7${phoneDigits}` }),
    });
    const result = await response.json();
    setLoadingProvider(null);

    if (!response.ok) {
      setError(result.error ?? "Не удалось начать вход через мессенджер");
      return;
    }

    setChallenge(result);
    openMessengerChallenge(result);
  }

  return (
    <div className="rounded-[1.7rem] border border-[var(--line)] bg-white/70 p-4">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {mode === "register" ? "Подтверждение телефона" : "Быстрый вход"}
        </span>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>
      <div className={`mt-4 grid gap-3 ${providers.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {providers.map((provider) => (
          <Button
            key={provider}
            variant="ghost"
            className="min-h-12"
            disabled={Boolean(loadingProvider) || isCompleting}
            onClick={() => void startMessenger(provider)}
          >
            {loadingProvider === provider ? (
              "Открываем..."
            ) : (
              <span className="flex items-center justify-center gap-3">
                {provider === "MAX" && <MaxMessengerIcon />}
                <span>
                  {mode === "register"
                    ? "Подтвердить номер"
                    : "Войти"}
                </span>
              </span>
            )}
          </Button>
        ))}
      </div>
      {challenge?.deepLink && (
        <div className="mt-3 space-y-3 rounded-2xl bg-white/65 p-3 ring-1 ring-[var(--line)]">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              className="min-h-11"
              disabled={isCompleting}
              onClick={() => openMessengerChallenge(challenge)}
            >
              Открыть {messengerProviderLabels[challenge.provider]} ещё раз
            </Button>
            <a
              href={challenge.deepLink}
              target={shouldUseSameWindowDeepLink(challenge.provider) ? "_self" : "_blank"}
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--line)] transition hover:bg-[var(--accent-soft)]"
            >
              Web-ссылка
            </a>
          </div>

          {challenge.provider === "TELEGRAM" && challenge.startCommand && (
            <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-100">
              <p className="font-semibold">
                Если Telegram открылся без кнопки, отправьте боту команду:
              </p>
              <code className="mt-2 block break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-[var(--foreground)] ring-1 ring-emerald-100">
                {challenge.startCommand}
              </code>
              <Button
                variant="ghost"
                className="mt-2 w-full"
                onClick={() => void copyStartCommand()}
              >
                {copiedCommand ? "Команда скопирована" : "Скопировать команду"}
              </Button>
            </div>
          )}
        </div>
      )}
      {message && <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>}
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
    </div>
  );
}

type PhoneCheckStatus = "idle" | "checking" | "available" | "exists";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const handledReturnChallengeRef = useRef("");
  const [form, setForm] = useState({ phoneDigits: "", password: "" });
  const [phoneStatus, setPhoneStatus] = useState<PhoneCheckStatus>("idle");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isPhoneKnown = phoneStatus === "exists";
  const returnChallengeId = searchParams.get("messengerChallengeId")?.trim() ?? "";

  useEffect(() => {
    if (!returnChallengeId || handledReturnChallengeRef.current === returnChallengeId) {
      return;
    }

    let cancelled = false;
    handledReturnChallengeRef.current = returnChallengeId;

    async function completeReturnedChallenge() {
      setError("");
      setIsLoading(true);

      try {
        const status = await fetchMessengerStatus(returnChallengeId);

        if (status.status !== "VERIFIED") {
          setError("Подтверждение MAX ещё не завершено. Вернитесь в MAX и поделитесь телефоном.");
          return;
        }

        const completeResponse = await fetch("/api/auth/messenger/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: returnChallengeId }),
        });
        const completeResult = await completeResponse.json();

        if (cancelled) {
          return;
        }

        if (!completeResponse.ok) {
          setError(completeResult.error ?? "Не удалось завершить вход через MAX");
          return;
        }

        clearMessengerReturnParam();
        router.push(getRedirectByRole(completeResult.role));
        router.refresh();
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Не удалось завершить вход через MAX",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void completeReturnedChallenge();

    return () => {
      cancelled = true;
    };
  }, [returnChallengeId, router]);

  useEffect(() => {
    function syncBrowserAutofill() {
      const phoneDigits = getRussianPhoneDigits(phoneInputRef.current?.value ?? "");
      const password = passwordInputRef.current?.value ?? "";

      if (!phoneDigits && !password) {
        return;
      }

      setForm((current) => {
        const nextPhoneDigits = phoneDigits || current.phoneDigits;
        const nextPassword = password || current.password;

        if (
          current.phoneDigits === nextPhoneDigits &&
          current.password === nextPassword
        ) {
          return current;
        }

        return {
          phoneDigits: nextPhoneDigits,
          password: nextPassword,
        };
      });
    }

    const timers = [150, 600, 1200].map((delay) =>
      window.setTimeout(syncBrowserAutofill, delay),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function getCredentialsFromFields() {
    const phoneDigits = getRussianPhoneDigits(
      phoneInputRef.current?.value || form.phoneDigits,
    );
    const password = passwordInputRef.current?.value || form.password;

    setForm((current) => {
      if (current.phoneDigits === phoneDigits && current.password === password) {
        return current;
      }

      return { phoneDigits, password };
    });

    return { phoneDigits, password };
  }

  async function checkPhone() {
    const { phoneDigits } = getCredentialsFromFields();
    setError("");

    if (phoneDigits.length !== 10) {
      setError("Укажите 10 цифр телефона после +7.");
      return;
    }

    setPhoneStatus("checking");
    const response = await fetch("/api/auth/login/check-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: `+7${phoneDigits}` }),
    });
    const result = await response.json();

    if (!response.ok) {
      setPhoneStatus("idle");
      setError(result.error ?? "Не удалось проверить телефон");
      return;
    }

    setPhoneStatus(result.exists ? "exists" : "available");
  }

  async function submit() {
    const credentials = getCredentialsFromFields();
    setError("");

    if (credentials.phoneDigits.length !== 10) {
      setError("Укажите 10 цифр телефона после +7.");
      return;
    }

    if (!isPhoneKnown) {
      setError("Сначала проверьте телефон.");
      return;
    }

    setIsLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: `+7${credentials.phoneDigits}`,
        password: credentials.password,
      }),
    });
    const result = await response.json();
    setIsLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Не удалось войти");
      return;
    }

    router.push(getRedirectByRole(result.role));
    router.refresh();
  }

  function updatePhoneDigits(phoneDigits: string) {
    setForm((current) => ({
      ...current,
      phoneDigits,
    }));
    setPhoneStatus("idle");
    setError("");
  }

  function updatePassword(password: string) {
    setForm((current) => ({ ...current, password }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPhoneKnown) {
      void submit();
      return;
    }

    void checkPhone();
  }

  return (
    <form className="space-y-4" autoComplete="on" onSubmit={handleSubmit}>
      <label className="block" htmlFor="login-phone">
        <span className="mb-2 block text-sm font-medium text-[var(--muted)]">
          Телефон
        </span>
        <PhoneDigitsInput
          id="login-phone"
          name="username"
          inputRef={phoneInputRef}
          value={form.phoneDigits}
          onChange={updatePhoneDigits}
          autoComplete="username"
        />
      </label>

      {phoneStatus === "available" && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
          <p className="font-semibold">Аккаунт с этим телефоном не найден.</p>
          <a href="/register" className="mt-1 inline-block font-semibold text-[var(--accent-strong)]">
            Зарегистрироваться
          </a>
        </div>
      )}

      <div
        className={isPhoneKnown ? "space-y-3" : "sr-only"}
        aria-hidden={!isPhoneKnown}
      >
        <input
          ref={passwordInputRef}
          id="login-password"
          name="password"
          value={form.password}
          onInput={(event) => updatePassword(event.currentTarget.value)}
          onChange={(event) => updatePassword(event.target.value)}
          type="password"
          placeholder="Пароль"
          autoComplete="current-password"
          tabIndex={isPhoneKnown ? undefined : -1}
          className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
        />
        {isPhoneKnown && <MessengerAuthPanel phoneDigits={form.phoneDigits} />}
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      {!isPhoneKnown ? (
        <Button
          type="submit"
          className="w-full"
          disabled={phoneStatus === "checking"}
        >
          {phoneStatus === "checking" ? "Проверяем..." : "Продолжить"}
        </Button>
      ) : (
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Входим..." : "Войти по паролю"}
        </Button>
      )}
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledReturnChallengeRef = useRef("");
  const [form, setForm] = useState({
    phoneDigits: "",
    password: "",
  });
  const [phoneStatus, setPhoneStatus] = useState<PhoneCheckStatus>("idle");
  const [verifiedChallenge, setVerifiedChallenge] =
    useState<VerifiedMessengerChallenge | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isPhoneVerified =
    phoneStatus === "available" && verifiedChallenge?.phoneDigits === form.phoneDigits;
  const returnChallengeId = searchParams.get("messengerChallengeId")?.trim() ?? "";

  useEffect(() => {
    if (!returnChallengeId || handledReturnChallengeRef.current === returnChallengeId) {
      return;
    }

    let cancelled = false;
    handledReturnChallengeRef.current = returnChallengeId;

    async function applyReturnedChallenge() {
      setError("");

      try {
        const status = await fetchMessengerStatus(returnChallengeId);

        if (cancelled) {
          return;
        }

        if (status.status !== "VERIFIED") {
          setError("Подтверждение MAX ещё не завершено. Вернитесь в MAX и поделитесь телефоном.");
          return;
        }

        const phoneDigits = getRussianPhoneDigits(status.phone ?? "");

        if (phoneDigits.length !== 10) {
          setError("MAX подтвердил номер, но приложение не смогло прочитать телефон. Начните регистрацию заново.");
          return;
        }

        setForm((current) => ({
          ...current,
          phoneDigits,
          password: current.phoneDigits === phoneDigits ? current.password : "",
        }));
        setPhoneStatus("available");
        setVerifiedChallenge({
          id: status.id,
          phoneDigits,
          provider: status.provider,
        });
        clearMessengerReturnParam();
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Не удалось применить подтверждение MAX",
          );
        }
      }
    }

    void applyReturnedChallenge();

    return () => {
      cancelled = true;
    };
  }, [returnChallengeId]);

  async function checkPhone() {
    setError("");
    setVerifiedChallenge(null);

    if (form.phoneDigits.length !== 10) {
      setError("Укажите 10 цифр телефона после +7.");
      return;
    }

    setPhoneStatus("checking");
    const response = await fetch("/api/auth/register/check-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: `+7${form.phoneDigits}` }),
    });
    const result = await response.json();

    if (!response.ok) {
      setPhoneStatus("idle");
      setError(result.error ?? "Не удалось проверить телефон");
      return;
    }

    setPhoneStatus(result.exists ? "exists" : "available");
  }

  async function submit() {
    setIsLoading(true);
    setError("");

    if (form.phoneDigits.length !== 10) {
      setIsLoading(false);
      setError("Укажите 10 цифр телефона после +7.");
      return;
    }

    const verifiedChallengeId =
      verifiedChallenge?.phoneDigits === form.phoneDigits
        ? verifiedChallenge.id
        : null;

    if (!verifiedChallengeId) {
      setIsLoading(false);
      setError("Сначала подтвердите этот номер через MAX.");
      return;
    }

    if (form.password.length < 6) {
      setIsLoading(false);
      setError("Пароль должен быть не короче 6 символов.");
      return;
    }

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: `+7${form.phoneDigits}`,
        password: form.password,
        messengerChallengeId: verifiedChallengeId,
      }),
    });
    const result = await response.json();
    setIsLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Не удалось зарегистрироваться");
      return;
    }

    router.push("/");
    router.refresh();
  }

  function updatePhoneDigits(value: string) {
    const phoneDigits = getRussianPhoneDigits(value);

    setForm((current) => ({
      ...current,
      phoneDigits,
      password: current.phoneDigits === phoneDigits ? current.password : "",
    }));
    setPhoneStatus("idle");
    setError("");
    setVerifiedChallenge((current) =>
      current?.phoneDigits === phoneDigits ? current : null,
    );
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[var(--muted)]">
          Телефон
        </span>
        <PhoneDigitsInput value={form.phoneDigits} onChange={updatePhoneDigits} />
      </label>

      {phoneStatus === "exists" && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
          <p className="font-semibold">Этот телефон уже зарегистрирован.</p>
          <a href="/login" className="mt-1 inline-block font-semibold text-[var(--accent-strong)]">
            Войти в аккаунт
          </a>
        </div>
      )}

      {phoneStatus === "available" && !isPhoneVerified && (
        <>
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100">
            Телефон свободен. Подтвердите номер через MAX, чтобы продолжить.
          </p>
          <MessengerAuthPanel
            phoneDigits={form.phoneDigits}
            mode="register"
            onVerified={setVerifiedChallenge}
            providers={defaultMessengerProviders}
          />
        </>
      )}

      {isPhoneVerified && verifiedChallenge && (
        <>
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100">
            Телефон подтверждён через {messengerProviderLabels[verifiedChallenge.provider]}.
            Задайте пароль для входа.
          </p>
          <input
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({ ...current, password: event.target.value }))
            }
            type="password"
            placeholder="Придумайте пароль"
            autoComplete="new-password"
            className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
          />
        </>
      )}

      {error && <p className="text-sm text-rose-700">{error}</p>}

      {!isPhoneVerified ? (
        <Button
          className="w-full"
          onClick={() => void checkPhone()}
          disabled={phoneStatus === "checking"}
        >
          {phoneStatus === "checking" ? "Проверяем..." : "Продолжить"}
        </Button>
      ) : (
        <Button className="w-full" onClick={() => void submit()} disabled={isLoading}>
          {isLoading ? "Создаём..." : "Создать аккаунт"}
        </Button>
      )}
    </div>
  );
}
