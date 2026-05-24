"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unitLabels } from "@/lib/constants";

type AssemblyOrder = {
  id: string;
  status: string;
  items: Array<{
    id: string;
    productId?: string | null;
    productName: string;
    orderedQuantity: number | string;
    unit?: string;
  }>;
};

type ProductSummary = {
  key: string;
  itemId: string;
  productName: string;
  unit?: string;
  quantity: number;
  orders: Set<string>;
};

const assemblyStatuses = new Set([
  "NEW",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "ASSEMBLING",
]);

function buildProductSummary(orders: AssemblyOrder[]) {
  const summary = new Map<string, ProductSummary>();

  for (const order of orders) {
    if (!assemblyStatuses.has(order.status)) {
      continue;
    }

    for (const item of order.items) {
      const key = item.productId ?? item.productName;
      const current = summary.get(key);
      const quantity = Number(item.orderedQuantity) || 0;

      if (current) {
        current.quantity += quantity;
        current.orders.add(order.id);
        continue;
      }

      summary.set(key, {
        key,
        itemId: item.id,
        productName: item.productName,
        unit: item.unit,
        quantity,
        orders: new Set([order.id]),
      });
    }
  }

  return [...summary.values()].sort((first, second) =>
    first.productName.localeCompare(second.productName, "ru"),
  );
}

function formatQuantity(value: number, unit?: string) {
  const quantity = Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

  return `${quantity} ${unit ? unitLabels[unit] ?? unit : ""}`.trim();
}

export function AssemblyProductShortagePanel({
  orders,
}: {
  orders: AssemblyOrder[];
}) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const products = buildProductSummary(orders);

  async function markUnavailable(product: ProductSummary) {
    setBusyKey(product.key);
    setError("");
    setMessage("");

    const response = await fetch(
      `/api/admin/order-items/${product.itemId}/unavailable`,
      {
        method: "POST",
      },
    );
    const result = await response.json();

    setBusyKey("");

    if (!response.ok) {
      setError(result.error ?? "Не удалось отправить уведомления");
      return;
    }

    setMessage(
      `По позиции «${result.productName}» уведомили клиентов: ${result.notifiedCustomers}. Затронуто заказов: ${result.affectedOrders}.`,
    );
    startTransition(() => router.refresh());
  }

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
            Список для сборщика
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Товары в заказах</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Если позиции сегодня нет в хорошем качестве, нажмите кнопку напротив
            товара. Клиенты получат уведомление и смогут выбрать новую дату доставки.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <AlertTriangle size={16} />
          Уведомления уходят по всем активным заказам
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {products.length === 0 ? (
          <div className="rounded-[1.5rem] bg-white/80 p-5 text-sm text-[var(--muted)]">
            На выбранную дату пока нет товаров в активной сборке.
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.key}
              className="flex flex-col gap-3 rounded-[1.5rem] bg-white/88 p-4 ring-1 ring-[var(--line)] md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold">{product.productName}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Всего: {formatQuantity(product.quantity, product.unit)} · Заказов:{" "}
                  {product.orders.size}
                </p>
              </div>
              <Button
                variant="ghost"
                className="gap-2 text-rose-700 ring-1 ring-rose-100 hover:bg-rose-50"
                disabled={busyKey === product.key || isPending}
                onClick={() => markUnavailable(product)}
              >
                <Send size={16} />
                {busyKey === product.key ? "Отправляем..." : "Отсутствует товар"}
              </Button>
            </div>
          ))
        )}
      </div>

      {message && (
        <div className="mt-4 rounded-[1.25rem] bg-emerald-50 p-4 text-sm text-emerald-900">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-[1.25rem] bg-rose-50 p-4 text-sm text-rose-900">
          {error}
        </div>
      )}
    </section>
  );
}
