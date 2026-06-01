"use client";

import { useRouter } from "next/navigation";
import type { DragEvent } from "react";
import { useState } from "react";
import { Route, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RebalanceProposal = {
  date: string;
  unassignedCount: number;
  changes: Array<{
    orderId: string;
    orderNumber: string;
    customerName: string;
    address: string;
    currentCourierName: string | null;
    suggestedCourierName: string;
    routeOrder: number;
  }>;
  routes: Array<{
    courierId: string;
    courierName: string;
    ordersCount: number;
    distanceKm: number;
    knownSegments: number;
    etaMinutes: number;
    orders: Array<{
      orderId: string;
      orderNumber: string;
      customerName: string;
      address: string;
      routeOrder: number;
    }>;
  }>;
};

type DraggedRouteOrder = {
  orderId: string;
  courierId: string;
};

function formatEta(minutes: number) {
  if (minutes < 60) {
    return `${minutes} мин`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest > 0 ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

async function requestRebalance(
  date: string,
  commit: boolean,
  assignments?: Array<{ orderId: string; courierId: string; routeOrder: number }>,
) {
  const response = await fetch("/api/admin/delivery/rebalance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, commit, assignments }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Не удалось пересчитать маршруты");
  }

  return payload as RebalanceProposal;
}

export function AdminRouteRebalancePanel({
  date,
  unassignedCount,
}: {
  date: string;
  unassignedCount: number;
}) {
  const router = useRouter();
  const [proposal, setProposal] = useState<RebalanceProposal | null>(null);
  const [draggedOrder, setDraggedOrder] = useState<DraggedRouteOrder | null>(null);
  const [dropCourierId, setDropCourierId] = useState<string | null>(null);
  const [hasManualChanges, setHasManualChanges] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function preview() {
    setIsPreviewing(true);
    setError("");
    setMessage("");

    try {
      setProposal(await requestRebalance(date, false));
      setHasManualChanges(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось пересчитать маршруты");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function apply() {
    setIsApplying(true);
    setError("");
    setMessage("");

    try {
      const assignments = proposal?.routes.flatMap((route) =>
        route.orders.map((order, index) => ({
          orderId: order.orderId,
          courierId: route.courierId,
          routeOrder: index + 1,
        })),
      );

      await requestRebalance(date, true, assignments);
      setHasManualChanges(false);
      setMessage("Маршруты перераспределены и сохранены.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сохранить маршруты");
    } finally {
      setIsApplying(false);
    }
  }

  function startRouteDrag(
    event: DragEvent<HTMLElement>,
    orderId: string,
    courierId: string,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", orderId);
    setDraggedOrder({ orderId, courierId });
  }

  function allowRouteDrop(event: DragEvent<HTMLElement>, courierId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropCourierId(courierId);
  }

  function dropRouteOrder(event: DragEvent<HTMLElement>, targetCourierId: string) {
    event.preventDefault();

    if (!draggedOrder || !proposal) {
      setDropCourierId(null);
      return;
    }

    const dragged = proposal.routes
      .flatMap((currentRoute) => currentRoute.orders)
      .find((order) => order.orderId === draggedOrder.orderId);

    if (!dragged) {
      setDraggedOrder(null);
      setDropCourierId(null);
      return;
    }

    setProposal({
      ...proposal,
      routes: proposal.routes.map((route) => {
        const routeWithoutDraggedOrder = route.orders.filter(
          (order) => order.orderId !== draggedOrder.orderId,
        );
        const nextOrders =
          route.courierId === targetCourierId
            ? [...routeWithoutDraggedOrder, dragged]
            : routeWithoutDraggedOrder;

        return {
          ...route,
          ordersCount: nextOrders.length,
          orders: nextOrders.map((order, index) => ({
            ...order,
            routeOrder: index + 1,
          })),
        };
      }),
    });
    setHasManualChanges(true);
    setDraggedOrder(null);
    setDropCourierId(null);
  }

  function endRouteDrag() {
    setDraggedOrder(null);
    setDropCourierId(null);
  }

  return (
    <section className="glass-panel rounded-[2.2rem] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
            Автораспределение
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Перераспределить маршруты</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Система сравнит адреса, текущую загрузку и компактность маршрутов,
            затем покажет предложение перед сохранением.
          </p>
        </div>
        <Button onClick={preview} disabled={isPreviewing || isApplying}>
          {isPreviewing ? "Считаем..." : "Перераспределить маршруты"}
        </Button>
      </div>

      {unassignedCount > 0 ? (
        <div className="mt-4 flex gap-3 rounded-[1.5rem] bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-100">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <p>Внимание! Есть {unassignedCount} заказ(ов) без назначенного курьера.</p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-[1.5rem] bg-rose-50 p-4 text-sm text-rose-900 ring-1 ring-rose-100">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mt-4 rounded-[1.5rem] bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-100">
          {message}
        </div>
      ) : null}

      {proposal ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.5rem] bg-white/82 p-4">
              <p className="text-sm text-[var(--muted)]">Курьеров</p>
              <p className="mt-2 text-3xl font-semibold">{proposal.routes.length}</p>
            </div>
            <div className="rounded-[1.5rem] bg-white/82 p-4">
              <p className="text-sm text-[var(--muted)]">Заказов в маршрутах</p>
              <p className="mt-2 text-3xl font-semibold">
                {proposal.routes.reduce((sum, route) => sum + route.ordersCount, 0)}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-white/82 p-4">
              <p className="text-sm text-[var(--muted)]">Смен курьера</p>
              <p className="mt-2 text-3xl font-semibold">{proposal.changes.length}</p>
            </div>
          </div>

          {proposal.routes.length === 0 ? (
            <div className="rounded-[1.5rem] bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-100">
              Нет активных курьеров для автоматического распределения.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {proposal.routes.map((route) => (
                <article
                  key={route.courierId}
                  onDragOver={(event) => allowRouteDrop(event, route.courierId)}
                  onDragLeave={() => setDropCourierId(null)}
                  onDrop={(event) => dropRouteOrder(event, route.courierId)}
                  className={cn(
                    "rounded-[1.8rem] bg-white/86 p-4 ring-1 ring-[var(--line)] transition",
                    dropCourierId === route.courierId &&
                      "bg-lime-50/90 ring-2 ring-lime-300",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
                        Курьер
                      </p>
                      <h3 className="mt-1 text-xl font-semibold">{route.courierName}</h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {route.ordersCount} заказов · {route.distanceKm.toFixed(1)} км ·{" "}
                        {formatEta(route.etaMinutes)}
                      </p>
                    </div>
                    <Route size={20} className="text-[var(--accent-strong)]" />
                  </div>

                  <div className="mt-4 space-y-2">
                    {route.orders.map((order) => {
                      const change = proposal.changes.find(
                        (item) => item.orderId === order.orderId,
                      );

                      return (
                        <div
                          key={order.orderId}
                          draggable
                          onDragStart={(event) =>
                            startRouteDrag(event, order.orderId, route.courierId)
                          }
                          onDragEnd={endRouteDrag}
                          className={cn(
                            "cursor-grab rounded-[1.25rem] bg-[var(--surface-muted)] p-3 text-sm active:cursor-grabbing",
                            change && "bg-lime-50 ring-1 ring-lime-100",
                            draggedOrder?.orderId === order.orderId && "opacity-55",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                              {order.routeOrder}
                            </span>
                            <p className="font-semibold">{order.orderNumber}</p>
                            {change ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2 py-1 text-xs font-semibold text-lime-900">
                                <Sparkles size={12} />
                                смена
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[var(--muted)]">
                            {order.customerName} · {order.address}
                          </p>
                        </div>
                      );
                    })}
                    {route.orders.length === 0 ? (
                      <div className="rounded-[1.25rem] bg-[var(--surface-muted)] p-3 text-sm text-[var(--muted)]">
                        Перетащите сюда заказ, если курьер должен выйти на линию.
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-[1.7rem] bg-white/82 p-4 ring-1 ring-[var(--line)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              {hasManualChanges
                ? "Ручные перемещения будут сохранены как новый маршрут выбранной даты."
                : "Подтверждение сохранит курьеров и порядок точек для выбранной даты."}
            </p>
            <Button onClick={apply} disabled={isApplying || proposal.routes.length === 0}>
              {isApplying ? "Сохраняем..." : "Подтвердить распределение"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
