"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  Clock3,
  Columns3,
  LayoutList,
  MapPin,
  Package,
  Truck,
} from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { cn, formatCurrency, getOrderStatusLabel } from "@/lib/utils";

const flowStatuses = ["NEW", "CONFIRMED", "HANDED_TO_COURIER"] as const;

const kanbanLanes = [
  {
    key: "new",
    label: "Новый",
    hint: "Принять и уточнить",
    statuses: ["NEW", "PENDING_CONFIRMATION"],
    accent: "from-emerald-50 via-white to-white ring-emerald-100",
  },
  {
    key: "confirmed",
    label: "Подтверждён",
    hint: "Готовится к сборке",
    statuses: ["CONFIRMED", "ASSEMBLING", "ASSEMBLED"],
    accent: "from-lime-50 via-white to-white ring-lime-100",
  },
  {
    key: "delivery",
    label: "В доставке",
    hint: "Курьер и завершение",
    statuses: [
      "HANDED_TO_COURIER",
      "COURIER_ON_THE_WAY",
      "DELIVERED",
      "DELIVERY_ISSUE",
      "CANCELLED",
    ],
    accent: "from-sky-50 via-white to-white ring-sky-100",
  },
] as const;

type AdminOrder = {
  id: string;
  orderNumber: string;
  status: string;
  sharedCartId?: string | null;
  sharedCartTitle?: string | null;
  preliminaryTotal: number | string;
  finalTotal: number | string | null;
  needsLift?: boolean;
  user: { name: string; phone?: string | null };
  address: { city: string; street: string; house: string; apartment?: string | null };
  deliveryTimeSlot: { title: string };
  items: Array<{
    id: string;
    productName: string;
    orderedQuantity: number | string;
    isPreorder?: boolean;
  }>;
  courier?: { id: string; name: string } | null;
};

function compactAddress(order: AdminOrder) {
  return `${order.address.street}, ${order.address.house}${
    order.address.apartment ? `, кв. ${order.address.apartment}` : ""
  }`;
}

function getFlowProgress(status: string) {
  if (status === "DELIVERY_ISSUE" || status === "CANCELLED") {
    return 100;
  }

  if (["HANDED_TO_COURIER", "COURIER_ON_THE_WAY", "DELIVERED"].includes(status)) {
    return 100;
  }

  if (["CONFIRMED", "ASSEMBLING", "ASSEMBLED"].includes(status)) {
    return 66;
  }

  return 33;
}

function OrderMiniCard({ order, dense = false }: { order: AdminOrder; dense?: boolean }) {
  const preorderCount = order.items.filter((item) => item.isPreorder).length;

  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className={cn(
        "group block rounded-[1.6rem] bg-white/92 p-4 shadow-sm ring-1 ring-[var(--line)] transition hover:-translate-y-0.5 hover:shadow-xl",
        dense ? "space-y-3" : "space-y-4",
        !order.courier && "bg-amber-50/90 ring-amber-200",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{order.orderNumber}</p>
          <p className="mt-1 truncate text-sm text-[var(--muted)]">{order.user.name}</p>
          {order.sharedCartId ? (
            <p className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
              Общий заказ
            </p>
          ) : null}
        </div>
        <StatusPill status={order.status} />
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <span
          className="block h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${getFlowProgress(order.status)}%` }}
        />
      </div>

      <div className="grid gap-2 text-sm text-[var(--muted)]">
        <p className="flex items-center gap-2">
          <Clock3 size={14} />
          <span>{order.deliveryTimeSlot.title}</span>
        </p>
        <p className="flex min-w-0 items-center gap-2">
          <MapPin size={14} />
          <span className="truncate">{compactAddress(order)}</span>
        </p>
        {!dense ? (
          <p className="flex items-center gap-2">
            <Truck size={14} />
            <span
              className={cn(
                !order.courier && "font-semibold text-amber-800",
              )}
            >
              {order.courier?.name ?? "курьер не назначен"}
            </span>
          </p>
        ) : null}
        {order.needsLift ? (
          <p className="flex items-center gap-2 font-semibold text-[var(--accent-strong)]">
            <ArrowUp size={14} />
            <span>подъём до двери</span>
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Package size={15} />
          <span>{order.items.length} поз.</span>
          {preorderCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
              {preorderCount} под заказ
            </span>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-sm font-bold">
            {formatCurrency(order.finalTotal ?? order.preliminaryTotal)}
          </p>
          <p className="text-xs text-[var(--muted)]">открыть</p>
        </div>
        <ArrowRight
          size={17}
          className="text-[var(--accent-strong)] transition group-hover:translate-x-1"
        />
      </div>
    </Link>
  );
}

function OrderStageProgress({ status }: { status: string }) {
  const progress = getFlowProgress(status);

  return (
    <div className="rounded-[1.5rem] bg-white/80 p-4 ring-1 ring-[var(--line)]">
      <div className="grid grid-cols-3 gap-2">
        {flowStatuses.map((flowStatus) => {
          const isActive =
            flowStatus === "NEW"
              ? progress >= 33
              : flowStatus === "CONFIRMED"
                ? progress >= 66
                : progress >= 100;

          return (
            <div
              key={flowStatus}
              className={cn(
                "rounded-2xl px-3 py-2 text-center text-xs font-semibold",
                isActive
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-muted)] text-[var(--muted)]",
              )}
            >
              {getOrderStatusLabel(flowStatus)}
            </div>
          );
        })}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <span
          className="block h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function AdminOrderManager({ orders }: { orders: AdminOrder[] }) {
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");
  const ordersByLane = useMemo(() => {
    return kanbanLanes.map((lane) => ({
      ...lane,
      orders: orders.filter((order) => lane.statuses.includes(order.status as never)),
    }));
  }, [orders]);

  return (
    <section className="space-y-4">
      <div className="glass-panel flex flex-col gap-4 rounded-[2rem] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
            Операционный экран
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Заказы по этапам</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {orders.length} заказов. Изменения внутри карточки заказа.
          </p>
        </div>

        <div className="inline-flex rounded-full bg-white/80 p-1 ring-1 ring-[var(--line)]">
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
              viewMode === "kanban"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--muted)] hover:bg-[var(--surface-muted)]",
            )}
          >
            <Columns3 size={16} />
            Канбан
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
              viewMode === "list"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--muted)] hover:bg-[var(--surface-muted)]",
            )}
          >
            <LayoutList size={16} />
            Список
          </button>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {ordersByLane.map((lane) => (
            <section
              key={lane.key}
              className={cn(
                "min-h-44 rounded-[2rem] bg-gradient-to-br p-4 ring-1",
                lane.accent,
              )}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{lane.label}</h3>
                  <p className="text-sm text-[var(--muted)]">{lane.hint}</p>
                </div>
                <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-white px-3 text-sm font-bold shadow-sm">
                  {lane.orders.length}
                </span>
              </div>

              <div className="space-y-3">
                {lane.orders.map((order) => (
                  <OrderMiniCard key={order.id} order={order} dense />
                ))}
                {lane.orders.length === 0 ? (
                  <div className="rounded-[1.5rem] bg-white/60 p-5 text-center text-sm text-[var(--muted)]">
                    Нет заказов
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {orders.map((order) => (
            <div key={order.id} className="space-y-3">
              <OrderMiniCard order={order} />
              <OrderStageProgress status={order.status} />
            </div>
          ))}
          {orders.length === 0 ? (
            <div className="glass-panel rounded-[2rem] p-8 text-center text-[var(--muted)] xl:col-span-2">
              Заказов по текущим фильтрам нет
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
