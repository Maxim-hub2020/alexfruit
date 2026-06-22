"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DragEvent } from "react";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  ArrowUp,
  CheckSquare,
  Clock3,
  Columns3,
  LayoutList,
  ListChecks,
  MapPin,
  Package,
  Square,
  Truck,
} from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { cn, formatCurrency, getOrderStatusLabel } from "@/lib/utils";

const flowStatuses = ["ASSEMBLING", "ASSEMBLED", "HANDED_TO_COURIER"] as const;

const bulkStatusOptions = [
  "ASSEMBLING",
  "ASSEMBLED",
  "HANDED_TO_COURIER",
  "COURIER_ON_THE_WAY",
  "DELIVERED",
  "DELIVERY_ISSUE",
  "CANCELLED",
] as const;

type BulkStatus = (typeof bulkStatusOptions)[number];

const kanbanLanes = [
  {
    key: "assembly",
    label: "Сборка",
    hint: "Проверка, вес и наличие",
    targetStatus: "ASSEMBLING",
    statuses: ["NEW", "PENDING_CONFIRMATION", "CONFIRMED", "ASSEMBLING"],
    accent: "from-emerald-50 via-white to-white ring-emerald-100",
  },
  {
    key: "assembled",
    label: "Собран",
    hint: "Готов к передаче",
    targetStatus: "ASSEMBLED",
    statuses: ["ASSEMBLED"],
    accent: "from-lime-50 via-white to-white ring-lime-100",
  },
  {
    key: "delivery",
    label: "В доставке",
    hint: "Курьер и завершение",
    targetStatus: "HANDED_TO_COURIER",
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

  if (["ASSEMBLED"].includes(status)) {
    return 66;
  }

  if (["NEW", "PENDING_CONFIRMATION", "CONFIRMED", "ASSEMBLING"].includes(status)) {
    return 33;
  }

  return 33;
}

function OrderMiniCard({
  order,
  dense = false,
  draggable = false,
  isDragging = false,
  selectable = false,
  selected = false,
  onDragStart,
  onDragEnd,
  onToggleSelected,
}: {
  order: AdminOrder;
  dense?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onDragStart?: (event: DragEvent<HTMLAnchorElement>) => void;
  onDragEnd?: () => void;
  onToggleSelected?: () => void;
}) {
  const preorderCount = order.items.filter((item) => item.isPreorder).length;

  return (
    <div className="relative">
      {selectable ? (
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`${selected ? "Убрать из выбора" : "Выбрать"} заказ ${order.orderNumber}`}
          onClick={onToggleSelected}
          className={cn(
            "absolute left-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[var(--muted)] shadow-sm ring-1 ring-[var(--line)] transition hover:text-[var(--accent-strong)]",
            selected && "bg-[var(--accent)] text-white ring-[var(--accent)] hover:text-white",
          )}
        >
          {selected ? <CheckSquare size={18} /> : <Square size={18} />}
        </button>
      ) : null}

      <Link
        href={`/admin/orders/${order.id}`}
        draggable={draggable}
        aria-grabbed={isDragging}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={cn(
          "group block rounded-[1.6rem] bg-white/92 p-4 shadow-sm ring-1 ring-[var(--line)] transition hover:-translate-y-0.5 hover:shadow-xl",
          selectable && "pl-16",
          selected && "bg-[var(--accent-soft)]/65 ring-2 ring-[var(--accent)]",
          draggable && "cursor-grab active:cursor-grabbing",
          isDragging && "opacity-55",
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
    </div>
  );
}

function OrderStageProgress({ status }: { status: string }) {
  const progress = getFlowProgress(status);

  return (
    <div className="rounded-[1.5rem] bg-white/80 p-4 ring-1 ring-[var(--line)]">
      <div className="grid grid-cols-3 gap-2">
        {flowStatuses.map((flowStatus) => {
          const isActive =
            flowStatus === "ASSEMBLING"
              ? progress >= 33
              : flowStatus === "ASSEMBLED"
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
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [activeLaneKey, setActiveLaneKey] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState<BulkStatus>("ASSEMBLED");
  const [bulkMessage, setBulkMessage] = useState("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const localOrders = useMemo(
    () =>
      orders.map((order) =>
        statusOverrides[order.id]
          ? { ...order, status: statusOverrides[order.id] }
          : order,
      ),
    [orders, statusOverrides],
  );
  const ordersByLane = useMemo(() => {
    return kanbanLanes.map((lane) => ({
      ...lane,
      orders: localOrders.filter((order) => lane.statuses.includes(order.status as never)),
    }));
  }, [localOrders]);
  const selectedOrders = useMemo(
    () => localOrders.filter((order) => selectedOrderIds.has(order.id)),
    [localOrders, selectedOrderIds],
  );
  const selectedCount = selectedOrders.length;
  const allOrdersSelected = localOrders.length > 0 && selectedCount === localOrders.length;

  function toggleOrderSelection(orderId: string) {
    setError("");
    setBulkMessage("");
    setSelectedOrderIds((current) => {
      const next = new Set(current);

      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }

      return next;
    });
  }

  function toggleAllOrders() {
    setError("");
    setBulkMessage("");
    setSelectedOrderIds(() => {
      if (allOrdersSelected) {
        return new Set();
      }

      return new Set(localOrders.map((order) => order.id));
    });
  }

  function toggleLaneOrders(orderIds: string[]) {
    setError("");
    setBulkMessage("");
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      const hasEveryLaneOrder = orderIds.length > 0 && orderIds.every((id) => next.has(id));

      for (const orderId of orderIds) {
        if (hasEveryLaneOrder) {
          next.delete(orderId);
        } else {
          next.add(orderId);
        }
      }

      return next;
    });
  }

  function clearSelection() {
    setSelectedOrderIds(new Set());
  }

  async function moveSelectedOrdersToStatus(status: BulkStatus) {
    setError("");
    setBulkMessage("");

    if (selectedOrders.length === 0) {
      setError("Выберите хотя бы один заказ для массового изменения.");
      return;
    }

    const ordersToMove = selectedOrders.filter((order) => order.status !== status);

    if (ordersToMove.length === 0) {
      setBulkMessage("Выбранные заказы уже находятся в этом статусе.");
      return;
    }

    if (status === "HANDED_TO_COURIER") {
      const withoutCourier = ordersToMove.filter((order) => !order.courier);

      if (withoutCourier.length > 0) {
        setError(
          `Нельзя передать в доставку ${withoutCourier.length} заказ(ов): сначала назначьте курьера.`,
        );
        return;
      }
    }

    const previousStatuses = new Map(ordersToMove.map((order) => [order.id, order.status]));
    const originalStatuses = new Map(orders.map((order) => [order.id, order.status]));
    setIsBulkUpdating(true);
    setStatusOverrides((current) => {
      const next = { ...current };

      for (const order of ordersToMove) {
        next[order.id] = status;
      }

      return next;
    });

    try {
      const response = await fetch("/api/admin/orders/bulk-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: ordersToMove.map((order) => order.id),
          status,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setStatusOverrides((current) => {
          const next = { ...current };

          for (const [orderId, previousStatus] of previousStatuses) {
            if (originalStatuses.get(orderId) === previousStatus) {
              delete next[orderId];
            } else {
              next[orderId] = previousStatus;
            }
          }

          return next;
        });
        setError(payload?.error ?? "Не удалось массово изменить статус заказов.");
        return;
      }

      const payload = await response.json().catch(() => null);
      clearSelection();
      setBulkMessage(
        `Статус обновлён для ${payload?.count ?? ordersToMove.length} заказ(ов).`,
      );

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setStatusOverrides((current) => {
        const next = { ...current };

        for (const [orderId, previousStatus] of previousStatuses) {
          if (originalStatuses.get(orderId) === previousStatus) {
            delete next[orderId];
          } else {
            next[orderId] = previousStatus;
          }
        }

        return next;
      });
      setError("Сетевая ошибка: не удалось массово изменить статус заказов.");
    } finally {
      setIsBulkUpdating(false);
    }
  }

  function startKanbanDrag(event: DragEvent<HTMLAnchorElement>, orderId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", orderId);
    setDraggedOrderId(orderId);
    setError("");
  }

  function allowKanbanDrop(event: DragEvent<HTMLElement>, laneKey: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActiveLaneKey(laneKey);
  }

  async function moveOrderToStatus(orderId: string, status: string) {
    const currentOrder = localOrders.find((order) => order.id === orderId);

    if (!currentOrder || currentOrder.status === status) {
      return;
    }

    if (status === "HANDED_TO_COURIER" && !currentOrder.courier) {
      setError("Сначала назначьте курьера, потом переносите заказ в доставку.");
      return;
    }

    setStatusOverrides((current) => ({ ...current, [orderId]: status }));

    const response = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setStatusOverrides((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      setError(payload?.error ?? "Не удалось изменить статус заказа");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  function dropKanbanOrder(event: DragEvent<HTMLElement>, targetStatus: string) {
    event.preventDefault();
    const orderId = draggedOrderId ?? event.dataTransfer.getData("text/plain");

    setDraggedOrderId(null);
    setActiveLaneKey(null);

    if (!orderId) {
      return;
    }

    void moveOrderToStatus(orderId, targetStatus);
  }

  function endKanbanDrag() {
    setDraggedOrderId(null);
    setActiveLaneKey(null);
  }

  return (
    <section className="space-y-4">
      <div className="glass-panel flex flex-col gap-4 rounded-[2rem] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
            Операционный экран
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Заказы по этапам</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {localOrders.length} заказов. Карточки можно перетаскивать между этапами.
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

      <div className="glass-panel flex flex-col gap-3 rounded-[1.8rem] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <ListChecks size={20} />
          </span>
          <div>
            <p className="font-semibold">Массовое изменение статуса</p>
            <p className="text-sm text-[var(--muted)]">
              Выбрано {selectedCount} из {localOrders.length} заказов. Изменение уйдёт одним запросом.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={toggleAllOrders}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--line)] transition hover:bg-[var(--surface-muted)]"
          >
            {allOrdersSelected ? "Снять выбор" : "Выбрать все"}
          </button>
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] transition hover:bg-[var(--surface-muted)]"
            >
              Очистить
            </button>
          ) : null}
          <select
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value as BulkStatus)}
            className="h-11 rounded-2xl bg-white px-4 text-sm font-semibold outline-none ring-1 ring-[var(--line)]"
          >
            {bulkStatusOptions.map((status) => (
              <option key={status} value={status}>
                {getOrderStatusLabel(status)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void moveSelectedOrdersToStatus(bulkStatus)}
            disabled={selectedCount === 0 || isBulkUpdating}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isBulkUpdating ? "Переносим..." : "Перенести выбранные"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-[1.5rem] bg-rose-50 p-4 text-sm text-rose-900 ring-1 ring-rose-100">
          {error}
        </div>
      ) : null}

      {bulkMessage ? (
        <div className="rounded-[1.5rem] bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-100">
          {bulkMessage}
        </div>
      ) : null}

      {viewMode === "kanban" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {ordersByLane.map((lane) => {
            const laneOrderIds = lane.orders.map((order) => order.id);
            const isLaneSelected =
              laneOrderIds.length > 0 && laneOrderIds.every((id) => selectedOrderIds.has(id));

            return (
              <section
                key={lane.key}
                onDragOver={(event) => allowKanbanDrop(event, lane.key)}
                onDragLeave={() => setActiveLaneKey(null)}
                onDrop={(event) => dropKanbanOrder(event, lane.targetStatus)}
                className={cn(
                  "min-h-44 rounded-[2rem] bg-gradient-to-br p-4 ring-1 transition",
                  lane.accent,
                  activeLaneKey === lane.key && "scale-[1.01] ring-2 ring-[var(--accent)]",
                )}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{lane.label}</h3>
                    <p className="text-sm text-[var(--muted)]">{lane.hint}</p>
                    {laneOrderIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleLaneOrders(laneOrderIds)}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-[var(--accent-strong)] shadow-sm ring-1 ring-[var(--line)] transition hover:bg-white"
                      >
                        {isLaneSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                        {isLaneSelected ? "Снять колонку" : "Выбрать колонку"}
                      </button>
                    ) : null}
                  </div>
                  <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-white px-3 text-sm font-bold shadow-sm">
                    {lane.orders.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {lane.orders.map((order) => (
                    <OrderMiniCard
                      key={order.id}
                      order={order}
                      dense
                      draggable
                      selectable
                      selected={selectedOrderIds.has(order.id)}
                      isDragging={draggedOrderId === order.id}
                      onToggleSelected={() => toggleOrderSelection(order.id)}
                      onDragStart={(event) => startKanbanDrag(event, order.id)}
                      onDragEnd={endKanbanDrag}
                    />
                  ))}
                  {lane.orders.length === 0 ? (
                    <div className="rounded-[1.5rem] bg-white/60 p-5 text-center text-sm text-[var(--muted)]">
                      Перетащите сюда заказ
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {localOrders.map((order) => (
            <div key={order.id} className="space-y-3">
              <OrderMiniCard
                order={order}
                selectable
                selected={selectedOrderIds.has(order.id)}
                onToggleSelected={() => toggleOrderSelection(order.id)}
              />
              <OrderStageProgress status={order.status} />
            </div>
          ))}
          {localOrders.length === 0 ? (
            <div className="glass-panel rounded-[2rem] p-8 text-center text-[var(--muted)] xl:col-span-2">
              Заказов по текущим фильтрам нет
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
