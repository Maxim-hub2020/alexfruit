"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useDeferredValue, useMemo, useState, useTransition } from "react";
import { Mail, Phone, Plus, Search, ShieldCheck, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDateLabel } from "@/lib/utils";

type CourierRecord = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  createdAt: string | Date;
  ordersCount: number;
  activeOrders: number;
  deliveredOrders: number;
  issueOrders: number;
  activeTasks: number;
  deliveredRevenue: number;
};

type CourierForm = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

const emptyCourierForm: CourierForm = {
  name: "",
  phone: "",
  email: "",
  password: "",
};

export function AdminCourierManager({ couriers }: { couriers: CourierRecord[] }) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [form, setForm] = useState<CourierForm>(emptyCourierForm);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const deferredQuery = useDeferredValue(query);

  const filteredCouriers = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return couriers;
    }

    return couriers.filter((courier) =>
      [courier.name, courier.phone, courier.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [couriers, deferredQuery]);

  function refreshCouriers() {
    startRefresh(() => {
      router.refresh();
    });
  }

  async function submitCourier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const response = await fetch("/api/admin/couriers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (!response.ok) {
      setFeedback({
        type: "error",
        message: result.error ?? "Не удалось добавить курьера.",
      });
      return;
    }

    setForm(emptyCourierForm);
    setFeedback({ type: "success", message: "Курьер добавлен в систему." });
    refreshCouriers();
  }

  async function deleteCourier(courier: CourierRecord) {
    if (
      !globalThis.confirm(
        `Удалить курьера "${courier.name}" из активной системы? История доставок будет сохранена для аналитики.`,
      )
    ) {
      return;
    }

    setDeletingId(courier.id);
    setFeedback(null);

    const response = await fetch(`/api/admin/couriers/${courier.id}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));
    setDeletingId(null);

    if (!response.ok) {
      setFeedback({
        type: "error",
        message: result.error ?? "Не удалось удалить курьера.",
      });
      return;
    }

    setFeedback({
      type: "success",
      message: result.archived
        ? "Курьер удалён из активной системы, история доставок сохранена."
        : "Курьер полностью удалён из системы.",
    });
    refreshCouriers();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="glass-panel rounded-[2rem] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              Команда доставки
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Новый курьер</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Создайте курьеру учётную запись. Он сможет войти в кабинет курьера
              по телефону и видеть назначенные заказы.
            </p>
          </div>
          <Truck className="text-[var(--accent-strong)]" size={22} />
        </div>

        <form className="mt-5 grid gap-3" onSubmit={submitCourier}>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Имя курьера"
            className="h-11 rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder="+7 900 000-00-00"
              className="h-11 rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
            />
            <input
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="Email для связи (необязательно)"
              className="h-11 rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
            />
          </div>

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
            {submitting ? "Добавляем..." : "Добавить курьера"}
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
              Курьеры
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Активная команда</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {filteredCouriers.length} курьеров
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
              placeholder="Найти курьера"
              className="h-11 min-w-[230px] rounded-2xl bg-white pl-10 pr-4 outline-none ring-1 ring-[var(--line)]"
            />
          </label>
        </div>

        <div className="mt-5 space-y-3">
          {filteredCouriers.map((courier) => (
            <article
              key={courier.id}
              className="rounded-[1.7rem] bg-white/90 p-4 ring-1 ring-[var(--line)]"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold">{courier.name}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                      <ShieldCheck size={13} />
                      Активен
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-3 py-1">
                      <Phone size={14} />
                      {courier.phone ?? "телефон не указан"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-3 py-1">
                      <Mail size={14} />
                      {courier.email ?? "email не указан"}
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm sm:grid-cols-4">
                    <StatPill label="Всего заказов" value={courier.ordersCount} />
                    <StatPill label="Активные" value={courier.activeOrders} />
                    <StatPill label="Доставлено" value={courier.deliveredOrders} />
                    <StatPill label="Проблемы" value={courier.issueOrders} />
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 xl:items-end">
                  <div className="text-left xl:text-right">
                    <p className="text-sm text-[var(--muted)]">Выручка по доставленным</p>
                    <p className="mt-1 text-2xl font-semibold">
                      {formatCurrency(courier.deliveredRevenue)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      В системе с {formatDateLabel(courier.createdAt)}
                    </p>
                  </div>

                  <Button
                    variant="danger"
                    className="gap-2"
                    onClick={() => deleteCourier(courier)}
                    disabled={deletingId === courier.id}
                  >
                    <Trash2 size={16} />
                    {deletingId === courier.id ? "Удаляем..." : "Удалить из системы"}
                  </Button>
                </div>
              </div>
            </article>
          ))}

          {filteredCouriers.length === 0 && (
            <div className="rounded-[1.7rem] bg-white/80 p-8 text-center text-[var(--muted)]">
              Курьеры по текущему поиску не найдены.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.1rem] bg-[var(--surface-muted)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
