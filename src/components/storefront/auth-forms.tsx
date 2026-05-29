"use client";

import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";

type LoginMode = "phone" | "email";

function getRedirectByRole(role: string) {
  if (role === "ADMIN") {
    return "/admin";
  }

  if (role === "COURIER") {
    return "/courier";
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
  placeholder = "9991234567",
}: {
  value: string;
  onChange: (value: string) => void;
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
        autoComplete="tel-national"
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-4 outline-none"
      />
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<LoginMode>("phone");
  const [form, setForm] = useState({ email: "", phoneDigits: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit() {
    setError("");

    if (loginMode === "phone" && form.phoneDigits.length !== 10) {
      setError("Укажите 10 цифр телефона после +7.");
      return;
    }

    const emailOrPhone =
      loginMode === "phone" ? `+7${form.phoneDigits}` : form.email.trim();

    setIsLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrPhone, password: form.password }),
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

  function updateEmail(value: string) {
    if (/^\s*\d/.test(value)) {
      setLoginMode("phone");
      setForm((current) => ({
        ...current,
        phoneDigits: getRussianPhoneDigits(value),
      }));
      return;
    }

    setForm((current) => ({ ...current, email: value }));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-2xl bg-white p-1 ring-1 ring-[var(--line)]">
        {(["phone", "email"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              setLoginMode(mode);
              setError("");
            }}
            className={`h-10 rounded-xl text-sm font-semibold transition ${
              loginMode === mode
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {mode === "phone" ? "Телефон" : "Email"}
          </button>
        ))}
      </div>

      {loginMode === "phone" ? (
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[var(--muted)]">
            Телефон
          </span>
          <PhoneDigitsInput
            value={form.phoneDigits}
            onChange={(phoneDigits) =>
              setForm((current) => ({ ...current, phoneDigits }))
            }
          />
        </label>
      ) : (
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[var(--muted)]">
            Email
          </span>
          <input
            value={form.email}
            onChange={(event) => updateEmail(event.target.value)}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@example.com"
            className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
          />
        </label>
      )}

      <input
        value={form.password}
        onChange={(event) =>
          setForm((current) => ({ ...current, password: event.target.value }))
        }
        type="password"
        placeholder="Пароль"
        className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
      />
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <Button className="w-full" onClick={() => submit()} disabled={isLoading}>
        {isLoading ? "Входим..." : "Войти"}
      </Button>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    phoneDigits: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit() {
    setIsLoading(true);
    setError("");

    if (form.phoneDigits.length !== 10) {
      setIsLoading(false);
      setError("Укажите 10 цифр телефона после +7.");
      return;
    }

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: `+7${form.phoneDigits}`,
        password: form.password,
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
    setForm((current) => ({
      ...current,
      phoneDigits: getRussianPhoneDigits(value),
    }));
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[var(--muted)]">
          Телефон
        </span>
        <PhoneDigitsInput value={form.phoneDigits} onChange={updatePhoneDigits} />
      </label>
      <input
        value={form.password}
        onChange={(event) =>
          setForm((current) => ({ ...current, password: event.target.value }))
        }
        type="password"
        placeholder="Пароль"
        className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
      />
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <Button className="w-full" onClick={() => submit()} disabled={isLoading}>
        {isLoading ? "Создаём..." : "Создать аккаунт"}
      </Button>
    </div>
  );
}
