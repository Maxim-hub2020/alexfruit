"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Share2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

type SharedCartCreatePanelProps = {
  user: { id: string; name: string } | null;
};

function getAbsoluteUrl(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

export function SharedCartCreatePanel({ user }: SharedCartCreatePanelProps) {
  const [title, setTitle] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function createSharedCart() {
    if (!user) {
      setError("Войдите в профиль, чтобы создать общую корзину.");
      return;
    }

    setError("");
    setMessage("");
    setIsCreating(true);

    try {
      const response = await fetch("/api/shared-carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Не удалось создать общую корзину.");
        return;
      }

      const nextUrl = getAbsoluteUrl(result.url);
      setShareUrl(nextUrl);
      setMessage("Ссылка создана. Общая корзина живёт отдельно от личной.");
    } catch {
      setError("Не удалось создать общую корзину. Проверьте подключение и попробуйте ещё раз.");
    } finally {
      setIsCreating(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Ссылка скопирована.");
    } catch {
      setMessage("Скопируйте ссылку вручную из поля ниже.");
    }
  }

  return (
    <div className="glass-panel rounded-[2rem] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <UsersRound size={20} />
            </span>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                Дополнительно
              </p>
              <h2 className="text-2xl font-semibold">Создать общую корзину</h2>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Фрукты в офис"
            className="h-12 w-full rounded-2xl bg-white px-4 text-sm outline-none ring-1 ring-[var(--line)]"
          />

          <Button
            className="w-full"
            onClick={createSharedCart}
            disabled={isCreating}
          >
            <Share2 size={16} />
            {isCreating ? "Создаём ссылку..." : "Создать общую корзину"}
          </Button>

          {!user && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Для создания общей корзины нужно войти в профиль.
            </p>
          )}

          {shareUrl && (
            <div className="space-y-2 rounded-[1.5rem] bg-white/82 p-3 ring-1 ring-[var(--line)]">
              <input
                value={shareUrl}
                readOnly
                className="h-11 w-full rounded-2xl bg-[var(--surface-muted)] px-3 text-sm outline-none"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={copyShareUrl}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--line)] transition active:scale-95"
                >
                  <Copy size={15} />
                  Скопировать
                </button>
                <Link
                  href={shareUrl}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white transition active:scale-95"
                >
                  Открыть
                </Link>
              </div>
            </div>
          )}

          {message && <p className="text-sm text-emerald-800">{message}</p>}
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
