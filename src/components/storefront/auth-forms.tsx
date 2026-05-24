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
        placeholder="Email или телефон"
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
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit() {
    setIsLoading(true);
    setError("");
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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

  return (
    <div className="space-y-4">
      <input
        value={form.name}
        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        placeholder="Имя"
        className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
      />
      <input
        value={form.email}
        onChange={(event) =>
          setForm((current) => ({ ...current, email: event.target.value }))
        }
        placeholder="Email"
        className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
      />
      <input
        value={form.phone}
        onChange={(event) =>
          setForm((current) => ({ ...current, phone: event.target.value }))
        }
        placeholder="Телефон"
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
        {isLoading ? "Создаём..." : "Создать аккаунт"}
      </Button>
    </div>
  );
}
