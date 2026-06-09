"use client";

import { useRouter } from "next/navigation";
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

type MessengerChallenge = {
  id: string;
  provider: MessengerProvider;
  deepLink: string;
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
  MAX: "Max",
};

const defaultMessengerProviders = ["TELEGRAM", "MAX"] as const;

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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const onVerifiedRef = useRef(onVerified);

  useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);

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
        setError(result.error ?? "Не удалось проверить подтверждение");
        return;
      }

      if (result.status === "VERIFIED") {
        completed = true;

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

  async function startMessenger(provider: MessengerProvider) {
    setError("");
    setMessage("");

    if (phoneDigits.length !== 10) {
      setError("Укажите 10 цифр телефона после +7.");
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
    setMessage(
      `Откройте ${messengerProviderLabels[provider]}, нажмите “Поделиться телефоном” и вернитесь сюда.`,
    );

    if (shouldUseSameWindowDeepLink(provider)) {
      window.location.assign(result.deepLink);
      return;
    }

    const popup = window.open(result.deepLink, "_blank", "noopener,noreferrer");

    if (!popup) {
      setMessage(
        `Браузер заблокировал открытие ${messengerProviderLabels[provider]}. Откройте ссылку ниже вручную.`,
      );
    }
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
            {loadingProvider === provider
              ? "Открываем..."
              : mode === "register"
                ? `Подтвердить номер телефона через ${messengerProviderLabels[provider]}`
                : messengerProviderLabels[provider]}
          </Button>
        ))}
      </div>
      {challenge?.deepLink && (
        <a
          href={challenge.deepLink}
          target={shouldUseSameWindowDeepLink(challenge.provider) ? "_self" : "_blank"}
          rel="noreferrer"
          className="mt-3 block text-center text-sm font-semibold text-[var(--accent-strong)]"
        >
          Открыть мессенджер вручную
        </a>
      )}
      {message && <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>}
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
    </div>
  );
}

type PhoneCheckStatus = "idle" | "checking" | "available" | "exists";

export function LoginForm() {
  const router = useRouter();
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ phoneDigits: "", password: "" });
  const [phoneStatus, setPhoneStatus] = useState<PhoneCheckStatus>("idle");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isPhoneKnown = phoneStatus === "exists";

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
      setError("Сначала подтвердите этот номер через Telegram или Max.");
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
            Телефон свободен. Подтвердите номер через Telegram или Max, чтобы продолжить.
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
