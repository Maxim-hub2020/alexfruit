"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type ProfileDetailsFormProps = {
  user: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
};

export function ProfileDetailsForm({ user }: ProfileDetailsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email ?? "",
    phone: user.phone ?? "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveProfile() {
    setError("");
    setSuccess("");
    setIsSaving(true);

    const response = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      setError(result.error ?? "Не удалось сохранить профиль");
      return;
    }

    setSuccess("Данные профиля обновлены");
    router.refresh();
  }

  return (
    <div className="rounded-[2rem] bg-white/82 p-5 ring-1 ring-[var(--line)]">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
          Личные данные
        </p>
        <h2 className="mt-1 text-2xl font-semibold">Редактировать профиль</h2>
      </div>

      <div className="mt-5 grid gap-3">
        <input
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          placeholder="Имя"
          className="h-12 rounded-2xl bg-[var(--surface-muted)] px-4 outline-none ring-1 ring-transparent focus:ring-[var(--accent-soft)]"
        />
        <input
          value={form.phone}
          onChange={(event) =>
            setForm((current) => ({ ...current, phone: event.target.value }))
          }
          placeholder="Телефон"
          className="h-12 rounded-2xl bg-[var(--surface-muted)] px-4 outline-none ring-1 ring-transparent focus:ring-[var(--accent-soft)]"
        />
        <input
          value={form.email}
          onChange={(event) =>
            setForm((current) => ({ ...current, email: event.target.value }))
          }
          placeholder="Email"
          className="h-12 rounded-2xl bg-[var(--surface-muted)] px-4 outline-none ring-1 ring-transparent focus:ring-[var(--accent-soft)]"
        />
      </div>

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
      {success && <p className="mt-3 text-sm text-[var(--accent-strong)]">{success}</p>}

      <Button className="mt-5 w-full" onClick={() => saveProfile()} disabled={isSaving}>
        {isSaving ? "Сохраняем..." : "Сохранить данные"}
      </Button>
    </div>
  );
}
