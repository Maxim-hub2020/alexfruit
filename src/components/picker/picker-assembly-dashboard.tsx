"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, FileText, PackageCheck, Phone, Scale, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfDownloadButton } from "@/components/ui/pdf-download-button";
import { StatusPill } from "@/components/ui/status-pill";
import { unitLabels } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";

type PickerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  sharedCartId?: string | null;
  sharedCartTitle?: string | null;
  preliminaryTotal: number | string;
  finalTotal?: number | string | null;
  user: {
    name: string;
    phone?: string | null;
  };
  address: {
    city: string;
    street: string;
    house: string;
    apartment?: string | null;
  };
  deliveryTimeSlot: {
    title: string;
  };
  items: Array<{
    id: string;
    productId?: string | null;
    productName: string;
    unit: string;
    price: number | string;
    orderedQuantity: number | string;
    actualQuantity?: number | string | null;
    isPreorder?: boolean;
    finalSum?: number | string | null;
    preliminarySum: number | string;
  }>;
  sharedCart?: {
    items?: Array<{
      id: string;
      productId: string;
      productName: string;
      unit: string;
      quantity: number | string;
      addedById: string;
      addedBy: {
        id: string;
        name: string;
        phone?: string | null;
      };
    }>;
  } | null;
};

type Feedback = {
  type: "success" | "error";
  message: string;
};

function quantityToInput(value: number | string | null | undefined, fallback: number | string) {
  return String(Number(value ?? fallback));
}

function parseQuantity(value: string) {
  const numeric = Number(value.trim().replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function addressLabel(order: PickerOrder) {
  return `${order.address.city}, ${order.address.street}, ${order.address.house}${
    order.address.apartment ? `, кв. ${order.address.apartment}` : ""
  }`;
}

function getParticipantGroups(order: PickerOrder) {
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      phone?: string | null;
      items: Array<{ productName: string; quantity: number | string; unit: string }>;
    }
  >();

  for (const item of order.sharedCart?.items ?? []) {
    const current =
      groups.get(item.addedById) ??
      {
        id: item.addedById,
        name: item.addedBy.name,
        phone: item.addedBy.phone,
        items: [],
      };

    current.items.push({
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
    });
    groups.set(item.addedById, current);
  }

  return [...groups.values()];
}

export function PickerAssemblyDashboard({
  date,
  orders,
}: {
  date: string;
  orders: PickerOrder[];
}) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      orders.flatMap((order) =>
        order.items.map((item) => [
          item.id,
          quantityToInput(item.actualQuantity, item.orderedQuantity),
        ]),
      ),
    ),
  );
  const [busyKey, setBusyKey] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [, startTransition] = useTransition();
  const assemblyUrl = `/api/admin/orders/assembly-pdf?date=${encodeURIComponent(date)}`;
  const labelsUrl = `/api/admin/orders/labels?date=${encodeURIComponent(date)}`;
  const stats = useMemo(() => {
    const itemsCount = orders.reduce((sum, order) => sum + order.items.length, 0);
    const preorderCount = orders.reduce(
      (sum, order) => sum + order.items.filter((item) => item.isPreorder).length,
      0,
    );

    return { itemsCount, preorderCount };
  }, [orders]);

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function saveOrder(order: PickerOrder) {
    setBusyKey(`save-${order.id}`);
    setFeedback(null);

    const payload = {
      items: order.items.map((item) => ({
        id: item.id,
        actualQuantity: parseQuantity(quantities[item.id] ?? "") ?? null,
      })),
    };
    const response = await fetch(`/api/picker/orders/${order.id}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    setBusyKey("");

    if (!response.ok) {
      setFeedback({
        type: "error",
        message: result.error ?? "Не удалось сохранить фактический вес.",
      });
      return false;
    }

    setFeedback({ type: "success", message: `Фактический вес ${order.orderNumber} сохранён.` });
    refresh();
    return true;
  }

  async function finishOrder(order: PickerOrder) {
    const saved = await saveOrder(order);

    if (!saved) {
      return;
    }

    setBusyKey(`finish-${order.id}`);
    const response = await fetch(`/api/picker/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ASSEMBLED" }),
    });
    const result = await response.json().catch(() => ({}));
    setBusyKey("");

    if (!response.ok) {
      setFeedback({
        type: "error",
        message: result.error ?? "Не удалось передать заказ после сборки.",
      });
      return;
    }

    setFeedback({
      type: "success",
      message: `${order.orderNumber} собран и передан администратору на доставку.`,
    });
    refresh();
  }

  async function markUnavailable(itemId: string, productName: string) {
    if (!globalThis.confirm(`Отметить "${productName}" как отсутствующий товар?`)) {
      return;
    }

    setBusyKey(`unavailable-${itemId}`);
    setFeedback(null);
    const response = await fetch(`/api/picker/order-items/${itemId}/unavailable`, {
      method: "POST",
    });
    const result = await response.json().catch(() => ({}));
    setBusyKey("");

    if (!response.ok) {
      setFeedback({
        type: "error",
        message: result.error ?? "Не удалось отметить товар отсутствующим.",
      });
      return;
    }

    setFeedback({
      type: "success",
      message: `Клиентам отправлено уведомление: "${productName}" отсутствует.`,
    });
    refresh();
  }

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[2rem] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Сборка на дату
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              {orders.length} заказ(ов), {stats.itemsCount} позиций
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Под заказ: {stats.preorderCount} позиций. Укажите фактический вес и
              передайте собранные заказы администратору.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={assemblyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)]"
            >
              <FileText size={16} />
              PDF сборки
            </Link>
            <PdfDownloadButton
              href={labelsUrl}
              filename={`alexfruit-labels-${date}.pdf`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
            >
              <FileText size={16} />
              Скачать этикетки PDF
            </PdfDownloadButton>
          </div>
        </div>

        {feedback ? (
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
        ) : null}
      </section>

      <div className="grid gap-5">
        {orders.map((order) => {
          const participants = getParticipantGroups(order);
          const isAssembled = order.status === "ASSEMBLED";

          return (
            <article key={order.id} className="glass-panel rounded-[2rem] p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-semibold">{order.orderNumber}</h3>
                    <StatusPill status={order.status} />
                    {order.sharedCartId ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                        Общая корзина
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                    <p className="flex items-center gap-2">
                      <UserRound size={15} />
                      {order.user.name} · {order.user.phone ?? "телефон не указан"}
                    </p>
                    <p>{addressLabel(order)}</p>
                    <p>Слот: {order.deliveryTimeSlot.title}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <PdfDownloadButton
                    href={`/api/admin/orders/${order.id}/label`}
                    filename={`alexfruit-label-${order.orderNumber}.pdf`}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--line)]"
                  >
                    <FileText size={16} />
                    Скачать PDF
                  </PdfDownloadButton>
                  <Button
                    className="gap-2"
                    onClick={() => finishOrder(order)}
                    disabled={busyKey !== "" || isAssembled}
                  >
                    <PackageCheck size={16} />
                    {isAssembled ? "Уже собран" : "Передать на доставку"}
                  </Button>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-[1.5rem] bg-white/86 ring-1 ring-[var(--line)]">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 border-b border-[var(--line)] p-4 last:border-b-0 lg:grid-cols-[1fr_180px_180px]"
                  >
                    <div>
                      <p className="font-semibold">{item.productName}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Заказано: {Number(item.orderedQuantity)} {unitLabels[item.unit] ?? item.unit} ·{" "}
                        {formatCurrency(item.finalSum ?? item.preliminarySum)}
                      </p>
                      {item.isPreorder ? (
                        <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                          Под заказ
                        </span>
                      ) : null}
                    </div>
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                        <Scale size={14} />
                        Факт
                      </span>
                      <input
                        value={quantities[item.id] ?? ""}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        inputMode="decimal"
                        className="h-11 w-full rounded-2xl bg-white px-4 text-lg font-semibold outline-none ring-1 ring-[var(--line)]"
                      />
                    </label>
                    <div className="flex items-end">
                      <Button
                        variant="danger"
                        className="w-full gap-2"
                        onClick={() => markUnavailable(item.id, item.productName)}
                        disabled={busyKey !== ""}
                      >
                        <AlertTriangle size={16} />
                        Нет товара
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {participants.length > 0 ? (
                <section className="mt-5 rounded-[1.7rem] bg-white/72 p-4 ring-1 ring-[var(--line)]">
                  <h4 className="text-lg font-semibold">Пакеты по участникам</h4>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Эти стикеры клеятся на пакет конкретного человека внутри общего заказа.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="rounded-[1.4rem] bg-white p-4 ring-1 ring-[var(--line)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{participant.name}</p>
                            <p className="mt-1 flex items-center gap-1 text-sm text-[var(--muted)]">
                              <Phone size={14} />
                              {participant.phone ?? "телефон не указан"}
                            </p>
                          </div>
                          <PdfDownloadButton
                            href={`/api/admin/orders/${order.id}/label?participantId=${participant.id}`}
                            filename={`alexfruit-label-${order.orderNumber}-${participant.id}.pdf`}
                            className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white"
                          >
                            PDF
                          </PdfDownloadButton>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                          {participant.items.map((item) => (
                            <p key={`${participant.id}-${item.productName}`}>
                              {item.productName}: {Number(item.quantity)}{" "}
                              {unitLabels[item.unit] ?? item.unit}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </article>
          );
        })}

        {orders.length === 0 ? (
          <div className="glass-panel rounded-[2rem] p-8 text-center text-[var(--muted)]">
            Заказов на сборку на выбранную дату нет.
          </div>
        ) : null}
      </div>
    </div>
  );
}
