"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneCallLink } from "@/components/ui/phone-call-link";
import { StatusPill } from "@/components/ui/status-pill";
import { orderStatusMeta } from "@/lib/constants";
import { formatCurrency, getOrderStatusLabel } from "@/lib/utils";

const quickStatusActions = ["CONFIRMED"];

export function AdminOrderManager({
  orders,
  couriers,
}: {
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    preliminaryTotal: number | string;
    finalTotal: number | string | null;
    customerComment?: string | null;
    adminComment?: string | null;
    user: { name: string; phone?: string | null };
    address: { city: string; street: string; house: string };
    deliveryTimeSlot: { title: string };
    items: Array<{ id: string; productName: string; orderedQuantity: number | string }>;
    courier?: { id: string; name: string } | null;
  }>;
  couriers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");

  async function changeStatus(orderId: string, status: string) {
    setBusyId(orderId);
    await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId("");
    router.refresh();
  }

  async function assignCourier(orderId: string, courierId: string) {
    setBusyId(orderId);
    await fetch(`/api/admin/orders/${orderId}/assign-courier`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courierId }),
    });
    setBusyId("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <article key={order.id} className="glass-panel rounded-[2rem] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold">{order.orderNumber}</h3>
                <StatusPill status={order.status} />
              </div>
              <p className="text-sm text-[var(--muted)]">
                {order.user.name} · {order.user.phone || "без телефона"} ·{" "}
                {order.address.city}, {order.address.street}, {order.address.house}
              </p>
              <PhoneCallLink phone={order.user.phone} className="mt-1" />
              <p className="text-sm text-[var(--muted)]">
                Слот: {order.deliveryTimeSlot.title} · Курьер:{" "}
                {order.courier?.name ?? "не назначен"}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {order.items.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[var(--foreground)]"
                  >
                    {item.productName} · {Number(item.orderedQuantity)}
                  </span>
                ))}
              </div>
            </div>

            <div className="w-full max-w-sm space-y-3 rounded-[1.5rem] bg-white/85 p-4 ring-1 ring-[var(--line)]">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[var(--muted)]">Предварительно</p>
                  <p className="font-semibold">{formatCurrency(order.preliminaryTotal)}</p>
                </div>
                <div>
                  <p className="text-[var(--muted)]">Итог</p>
                  <p className="font-semibold">
                    {formatCurrency(order.finalTotal ?? order.preliminaryTotal)}
                  </p>
                </div>
              </div>
              <select
                defaultValue={order.courier?.id ?? ""}
                onChange={(event) => assignCourier(order.id, event.target.value)}
                className="h-11 w-full rounded-2xl bg-[var(--surface-muted)] px-4 outline-none"
              >
                <option value="">Без курьера</option>
                {couriers.map((courier) => (
                  <option key={courier.id} value={courier.id}>
                    {courier.name}
                  </option>
                ))}
              </select>
              <div className="grid gap-2">
                {quickStatusActions.map((status) => (
                  <Button
                    key={status}
                    variant="ghost"
                    className="text-xs"
                    onClick={() => changeStatus(order.id, status)}
                    disabled={busyId === order.id}
                    title={orderStatusMeta[status]?.description}
                  >
                    {getOrderStatusLabel(status)}
                  </Button>
                ))}
              </div>
              <Link
                href={`/api/admin/orders/${order.id}/label`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              >
                <FileText size={16} />
                Этикетка 40×50 мм
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
