"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useDeferredValue, useMemo, useState, useTransition } from "react";
import { PackageCheck, Phone, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDateLabel } from "@/lib/utils";

type PickerRecord = {
  id: string;
  name: string;
  phone?: string | null;
  createdAt: string | Date;
};

type PickerForm = {
  name: string;
  phone: string;
  password: string;
};

const emptyPickerForm: PickerForm = {
  name: "",
  phone: "",
  password: "",
};

export function AdminPickerManager({ pickers }: { pickers: PickerRecord[] }) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [form, setForm] = useState<PickerForm>(emptyPickerForm);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const deferredQuery = useDeferredValue(query);

  const filteredPickers = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return pickers;
    }

    return pickers.filter((picker) =>
      [picker.name, picker.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [pickers, deferredQuery]);

  function refreshPickers() {
    startRefresh(() => {
      router.refresh();
    });
  }

  async function submitPicker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const response = await fetch("/api/admin/pickers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (!response.ok) {
      setFeedback({
        type: "error",
        message: result.error ?? "Не удалось добавить сборщика.",
      });
      return;
    }

    setForm(emptyPickerForm);
    setFeedback({ type: "success", message: "Сборщик добавлен в систему." });
    refreshPickers();
  }

  async function deletePicker(picker: PickerRecord) {
    if (!globalThis.confirm(`Удалить сборщика "${picker.name}" из системы?`)) {
      return;
    }

    setDeletingId(picker.id);
    setFeedback(null);

    const response = await fetch(`/api/admin/pickers/${picker.id}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));
    setDeletingId(null);

    if (!response.ok) {
      setFeedback({
        type: "error",
        message: result.error ?? "Не удалось удалить сборщика.",
      });
      return;
    }

    setFeedback({ type: "success", message: "Сборщик удалён." });
    refreshPickers();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="glass-panel rounded-[2rem] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              Команда сборки
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Новый сборщик</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Сборщик входит по телефону, видит только заказы на сборке, печатает
              этикетки и фиксирует фактический вес позиций.
            </p>
          </div>
          <PackageCheck className="text-[var(--accent-strong)]" size={22} />
        </div>

        <form className="mt-5 grid gap-3" onSubmit={submitPicker}>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Имя сборщика"
            className="h-11 rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
          />

          <input
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
            placeholder="+7 900 000-00-00"
            inputMode="tel"
            autoComplete="tel"
            className="h-11 rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
          />

          <input
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({ ...current, password: event.target.value }))
            }
            placeholder="Пароль для входа"
            className="h-11 rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
          />

          <Button type="submit" className="gap-2" disabled={submitting}>
            <Plus size={16} />
            {submitting ? "Добавляем..." : "Добавить сборщика"}
          </Button>
        </form>

        {feedback && (
          <div
            className={cn(
              "mt-4 rounded-[1.4rem] px-4 py-3 text-sm",
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-900"
                : "bg-rose-50 text-rose-900",
            )}
          >
            {feedback.message}
          </div>
        )}
      </section>

      <section className="glass-panel rounded-[2rem] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              Сборщики
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Активные доступы</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {filteredPickers.length} сборщик(ов)
              {isRefreshing ? " · обновляем список..." : ""}
            </p>
          </div>

          <label className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти сборщика"
              className="h-11 min-w-[230px] rounded-2xl bg-white pl-10 pr-4 outline-none ring-1 ring-[var(--line)]"
            />
          </label>
        </div>

        <div className="mt-5 space-y-3">
          {filteredPickers.map((picker) => (
            <article
              key={picker.id}
              className="rounded-[1.7rem] bg-white/90 p-4 ring-1 ring-[var(--line)]"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold">{picker.name}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                      <ShieldCheck size={13} />
                      Доступ выдан
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-3 py-1">
                      <Phone size={14} />
                      {picker.phone ?? "телефон не указан"}
                    </span>
                    <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1">
                      В системе с {formatDateLabel(picker.createdAt)}
                    </span>
                  </div>
                </div>

                <Button
                  variant="danger"
                  className="gap-2"
                  onClick={() => deletePicker(picker)}
                  disabled={deletingId === picker.id}
                >
                  <Trash2 size={16} />
                  {deletingId === picker.id ? "Удаляем..." : "Удалить"}
                </Button>
              </div>
            </article>
          ))}

          {filteredPickers.length === 0 && (
            <div className="rounded-[1.7rem] bg-white/80 p-8 text-center text-[var(--muted)]">
              Сборщики по текущему поиску не найдены.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
