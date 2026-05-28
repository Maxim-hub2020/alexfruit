"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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

export function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ emailOrPhone: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit() {
    setIsLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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

  return (
    <div className="space-y-4">
      <input
        value={form.emailOrPhone}
        onChange={(event) =>
          setForm((current) => ({ ...current, emailOrPhone: event.target.value }))
        }
        placeholder="Телефон +7..."
        inputMode="tel"
        autoComplete="tel"
        className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
      />
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
        <div className="flex h-12 overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--line)] focus-within:ring-[var(--accent-soft)]">
          <span className="flex shrink-0 items-center border-r border-[var(--line)] px-4 font-semibold text-[var(--foreground)]">
            +7
          </span>
          <input
            value={form.phoneDigits}
            onInput={(event) => updatePhoneDigits(event.currentTarget.value)}
            onChange={(event) => updatePhoneDigits(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
              }

              const navigationKeys = [
                "Backspace",
                "Delete",
                "ArrowLeft",
                "ArrowRight",
                "Tab",
                "Home",
                "End",
              ];

              if (navigationKeys.includes(event.key)) {
                return;
              }

              if (!/^\d$/.test(event.key)) {
                event.preventDefault();
                return;
              }

              const input = event.currentTarget;
              const hasSelection = input.selectionStart !== input.selectionEnd;

              if (form.phoneDigits.length >= 10 && !hasSelection) {
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
            placeholder="9991234567"
            className="min-w-0 flex-1 bg-transparent px-4 outline-none"
          />
        </div>
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
