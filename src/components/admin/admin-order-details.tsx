"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  MapPin,
  Package,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { PhoneCallLink } from "@/components/ui/phone-call-link";
import { StatusPill } from "@/components/ui/status-pill";
import { canPrintOrderLabelStatus } from "@/lib/constants";
import { cn, formatCurrency, formatDateLabel } from "@/lib/utils";

const stageActions = [
  {
    label: "Новый",
    description: "Заказ только поступил",
    status: "NEW",
    statuses: ["NEW", "PENDING_CONFIRMATION"],
  },
  {
    label: "Подтверждён",
    description: "Заказ принят в работу",
    status: "CONFIRMED",
    statuses: ["CONFIRMED", "ASSEMBLING", "ASSEMBLED"],
  },
  {
    label: "В доставке",
    description: "Передан курьеру",
    status: "HANDED_TO_COURIER",
    statuses: ["HANDED_TO_COURIER", "COURIER_ON_THE_WAY", "DELIVERED"],
  },
] as const;

type AdminOrderDetailsOrder = {
  id: string;
  orderNumber: string;
  status: string;
  sharedCartId?: string | null;
  sharedCartTitle?: string | null;
  sharedCart?: { title: string; token: string } | null;
  deliveryDate: string;
  preliminaryTotal: number | string;
  finalTotal: number | string | null;
  customerComment?: string | null;
  adminComment?: string | null;
  user: { name: string; phone?: string | null; email?: string | null };
  address: {
    city: string;
    street: string;
    house: string;
    apartment?: string | null;
    entrance?: string | null;
    floor?: string | null;
    comment?: string | null;
  };
  deliveryTimeSlot: { title: string };
  items: Array<{
    id: string;
    productName: string;
    unit: string;
    price: number | string;
    orderedQuantity: number | string;
    actualQuantity?: number | string | null;
    preliminarySum: number | string;
    finalSum?: number | string | null;
  }>;
  courier?: { id: string; name: string } | null;
};

function getStageIndex(status: string) {
  const index = stageActions.findIndex((stage) =>
    stage.statuses.includes(status as never),
  );
  return index >= 0 ? index : 0;
}

function getAddressLabel(order: AdminOrderDetailsOrder) {
  return [
    order.address.city,
    order.address.street,
    order.address.house,
    order.address.apartment ? `кв. ${order.address.apartment}` : "",
    order.address.entrance ? `подъезд ${order.address.entrance}` : "",
    order.address.floor ? `этаж ${order.address.floor}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export function AdminOrderDetails({
  order,
  couriers,
}: {
  order: AdminOrderDetailsOrder;
  couriers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const stageIndex = getStageIndex(order.status);
  const canPrintLabel = canPrintOrderLabelStatus(order.status);

  async function changeStatus(status: string) {
    setBusy(`status-${status}`);
    setError("");
    const response = await fetch(`/api/admin/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const result = await response.json();
      setError(result.error ?? "Не удалось изменить статус");
      setBusy("");
      return;
    }

    setBusy("");
    router.refresh();
  }

  async function assignCourier(courierId: string) {
    setBusy("courier");
    setError("");
    const response = await fetch(`/api/admin/orders/${order.id}/assign-courier`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courierId }),
    });

    if (!response.ok) {
      const result = await response.json();
      setError(result.error ?? "Не удалось назначить курьера");
      setBusy("");
      return;
    }

    setBusy("");
    router.refresh();
  }

  async function deleteOrder() {
    const isConfirmed = window.confirm(
      `Удалить заказ ${order.orderNumber}? Это действие нельзя отменить.`,
    );

    if (!isConfirmed) {
      return;
    }

    setBusy("delete");
    setError("");
    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const result = await response.json();
      setError(result.error ?? "Не удалось удалить заказ");
      setBusy("");
      return;
    }

    router.push("/admin/orders");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Link
          href="/admin/orders"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]"
        >
          <ArrowLeft size={16} />
          К заказам
        </Link>
        <StatusPill status={order.status} />
      </div>

      <section className="glass-panel rounded-[2.2rem] p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Карточка заказа
            </p>
            <h1 className="mt-2 font-serif text-5xl font-semibold">
              {order.orderNumber}
            </h1>
            {order.sharedCartId ? (
              <div className="mt-3 inline-flex flex-col rounded-[1.2rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-950 ring-1 ring-emerald-100">
                <span className="font-semibold">Общий заказ</span>
                <span className="text-emerald-800">
                  {order.sharedCartTitle ?? order.sharedCart?.title ?? "Создан из общей корзины"}
                </span>
              </div>
            ) : null}
            <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
              <p className="flex items-center gap-2">
                <CalendarDays size={16} />
                {formatDateLabel(order.deliveryDate)} · {order.deliveryTimeSlot.title}
              </p>
              <p className="flex items-center gap-2">
                <UserRound size={16} />
                {order.user.name} · {order.user.phone || "без телефона"}
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={16} />
                {getAddressLabel(order)}
              </p>
            </div>
            <div className="mt-4">
              <PhoneCallLink phone={order.user.phone} />
            </div>
          </div>

          <div className="w-full max-w-md rounded-[1.7rem] bg-white/86 p-4 ring-1 ring-[var(--line)]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-[var(--muted)]">Предварительно</p>
                <p className="text-xl font-bold">{formatCurrency(order.preliminaryTotal)}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Итог</p>
                <p className="text-xl font-bold">
                  {formatCurrency(order.finalTotal ?? order.preliminaryTotal)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <div className="glass-panel rounded-[2rem] p-5">
          <h2 className="text-2xl font-semibold">Этап заказа</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {stageActions.map((stage, index) => {
              const isActive = stageIndex >= index;
              const isCurrent = stage.statuses.includes(order.status as never);

              return (
                <button
                  key={stage.status}
                  type="button"
                  onClick={() => changeStatus(stage.status)}
                  disabled={busy !== ""}
                  className={cn(
                    "rounded-[1.5rem] p-4 text-left ring-1 transition hover:-translate-y-0.5",
                    isActive
                      ? "bg-[var(--accent)] text-white ring-[var(--accent)]"
                      : "bg-white text-[var(--foreground)] ring-[var(--line)]",
                    isCurrent && "shadow-xl",
                  )}
                >
                  <p className="text-lg font-bold">{stage.label}</p>
                  <p className={cn("mt-1 text-sm", isActive ? "text-white/78" : "text-[var(--muted)]")}>
                    {stage.description}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Детальные статусы внутри системы сохраняются, но для работы администратора
            оставлены три понятных этапа.
          </p>
        </div>

        <div className="glass-panel rounded-[2rem] p-5">
          <h2 className="text-2xl font-semibold">Действия</h2>
          <label className="mt-4 block space-y-2 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Truck size={16} />
              Курьер
            </span>
            <select
              defaultValue={order.courier?.id ?? ""}
              onChange={(event) => assignCourier(event.target.value)}
              disabled={busy !== ""}
              className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
            >
              <option value="">Без курьера</option>
              {couriers.map((courier) => (
                <option key={courier.id} value={courier.id}>
                  {courier.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid gap-3">
            {canPrintLabel ? (
              <Link
                href={`/api/admin/orders/${order.id}/label`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              >
                <FileText size={16} />
                Этикетка 40×50 мм
              </Link>
            ) : (
              <span className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/70 px-4 text-sm font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]">
                <FileText size={16} />
                Этикетка после подтверждения
              </span>
            )}
            <button
              type="button"
              onClick={deleteOrder}
              disabled={busy !== ""}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-rose-100 px-4 text-sm font-semibold text-rose-900 transition hover:bg-rose-200 disabled:opacity-60"
            >
              <Trash2 size={16} />
              Удалить заказ
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        </div>
      </section>

      <section className="glass-panel rounded-[2rem] p-5">
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          <Package size={21} />
          Состав заказа
        </h2>
        <div className="mt-4 overflow-hidden rounded-[1.5rem] bg-white/86 ring-1 ring-[var(--line)]">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="grid gap-2 border-b border-[var(--line)] p-4 last:border-b-0 md:grid-cols-[1fr_120px_130px]"
            >
              <div>
                <p className="font-semibold">{item.productName}</p>
                <p className="text-sm text-[var(--muted)]">
                  {formatCurrency(item.price)} · {item.unit}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Количество</p>
                <p className="font-semibold">{Number(item.orderedQuantity)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Сумма</p>
                <p className="font-semibold">
                  {formatCurrency(item.finalSum ?? item.preliminarySum)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {(order.customerComment || order.adminComment || order.address.comment) && (
        <section className="glass-panel rounded-[2rem] p-5">
          <h2 className="text-2xl font-semibold">Комментарии</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {order.customerComment ? (
              <div className="rounded-[1.5rem] bg-white/86 p-4">
                <p className="text-sm font-semibold">Клиент</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{order.customerComment}</p>
              </div>
            ) : null}
            {order.address.comment ? (
              <div className="rounded-[1.5rem] bg-white/86 p-4">
                <p className="text-sm font-semibold">Курьеру</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{order.address.comment}</p>
              </div>
            ) : null}
            {order.adminComment ? (
              <div className="rounded-[1.5rem] bg-white/86 p-4">
                <p className="text-sm font-semibold">Администратор</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{order.adminComment}</p>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
