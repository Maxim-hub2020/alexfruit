"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { PackageCheck, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unitLabels } from "@/lib/constants";
import { cn } from "@/lib/utils";

type InventoryProduct = {
  id: string;
  name: string;
  imageUrl?: string | null;
  unit: string;
  isActive: boolean;
  category: {
    name: string;
  };
  inventory: {
    quantityStart: number;
    quantityReserved: number;
    quantitySold: number;
    availableQuantity: number | null;
    isTracked: boolean;
  };
};

type InventoryFeedback = {
  type: "success" | "error";
  message: string;
};

function formatQuantity(value: number | null, unit: string) {
  if (value === null) {
    return "не задано";
  }

  const normalized = Number.isInteger(value) ? value.toString() : value.toFixed(2);

  return `${normalized} ${unitLabels[unit] ?? unit}`;
}

export function AdminInventoryManager({
  date,
  products,
  defaultDeliveryDate,
}: {
  date: string;
  products: InventoryProduct[];
  defaultDeliveryDate: string;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<InventoryFeedback | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [quantityByProductId, setQuantityByProductId] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      products.map((product) => [
        product.id,
        product.inventory.isTracked ? String(product.inventory.quantityStart) : "",
      ]),
    ),
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return products.filter((product) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.category.name.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [deferredQuery, products]);

  const changedCount = useMemo(
    () =>
      products.filter((product) => {
        const currentValue = quantityByProductId[product.id] ?? "";
        const currentNumber = currentValue === "" ? 0 : Number(currentValue);
        const initialNumber = product.inventory.isTracked
          ? product.inventory.quantityStart
          : 0;

        return Number.isFinite(currentNumber) && Math.abs(currentNumber - initialNumber) > 0.001;
      }).length,
    [products, quantityByProductId],
  );

  function changeDate(nextDate: string) {
    const nextUrl =
      nextDate && nextDate !== defaultDeliveryDate
        ? `/admin/inventory?date=${nextDate}`
        : "/admin/inventory";

    startRefresh(() => {
      router.replace(nextUrl);
    });
  }

  async function saveInventory() {
    setIsSaving(true);
    setFeedback(null);

    const response = await fetch("/api/admin/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        items: products.map((product) => ({
          productId: product.id,
          quantityStart: Math.max(0, Number(quantityByProductId[product.id] || 0)),
        })),
      }),
    });
    const result = await response.json();

    setIsSaving(false);

    if (!response.ok) {
      setFeedback({
        type: "error",
        message: result.error ?? "Не удалось сохранить склад на день.",
      });
      return;
    }

    setFeedback({
      type: "success",
      message: "Остатки на день сохранены. Витрина обновится по этой дате.",
    });
    startRefresh(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[2rem] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              Склад на день
            </p>
            <h2 className="mt-2 text-3xl font-semibold">Наличие для витрины</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Укажите, сколько товара можно продать на выбранную дату. Резерв
              уменьшается автоматически при заказах и отменах.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="grid gap-1 rounded-2xl bg-white/82 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)] ring-1 ring-[var(--line)]">
              Дата
              <input
                type="date"
                min={defaultDeliveryDate}
                value={date}
                onChange={(event) => changeDate(event.target.value)}
                className="bg-transparent text-base font-semibold tracking-normal text-[var(--foreground)] outline-none"
              />
            </label>
            <Button
              className="min-h-14 gap-2 px-5"
              onClick={() => saveInventory()}
              disabled={isSaving}
            >
              <Save size={17} />
              {isSaving ? "Сохраняем..." : "Сохранить склад"}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
          <span className="rounded-full bg-white/78 px-3 py-2 ring-1 ring-[var(--line)]">
            {products.length} товаров
          </span>
          <span className="rounded-full bg-white/78 px-3 py-2 ring-1 ring-[var(--line)]">
            Изменено: {changedCount}
          </span>
          {isRefreshing && (
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-[var(--accent-strong)]">
              Обновляем дату...
            </span>
          )}
        </div>

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
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              Остатки
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Мини-склад на выбранный день</h2>
          </div>

          <label className="relative w-full md:w-[24rem]">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти товар"
              className="h-11 w-full rounded-2xl bg-white pl-10 pr-4 outline-none ring-1 ring-[var(--line)]"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3">
          {filteredProducts.map((product) => {
            const unitLabel = unitLabels[product.unit] ?? product.unit;
            const availableLabel = formatQuantity(
              product.inventory.availableQuantity,
              product.unit,
            );

            return (
              <article
                key={product.id}
                className={cn(
                  "rounded-[1.7rem] bg-white/90 p-4 ring-1 ring-[var(--line)]",
                  !product.isActive && "opacity-60",
                )}
              >
                <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-center">
                  <div className="flex gap-4">
                    <div className="relative h-18 w-18 shrink-0 overflow-hidden rounded-[1.25rem] bg-[var(--surface-muted)]">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="72px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <PackageCheck size={28} className="text-[var(--accent-strong)]" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{product.name}</h3>
                        {!product.isActive && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            скрыт
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1">
                          {product.category.name}
                        </span>
                        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1">
                          ед.: {unitLabel}
                        </span>
                      </div>

                      <div className="grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-3">
                        <span>Резерв: {formatQuantity(product.inventory.quantityReserved, product.unit)}</span>
                        <span>Продано: {formatQuantity(product.inventory.quantitySold, product.unit)}</span>
                        <span>Доступно: {availableLabel}</span>
                      </div>
                    </div>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      Остаток на старт
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={quantityByProductId[product.id] ?? ""}
                        onChange={(event) =>
                          setQuantityByProductId((current) => ({
                            ...current,
                            [product.id]: event.target.value,
                          }))
                        }
                        placeholder="0"
                        className="h-12 w-full rounded-2xl bg-[var(--surface-muted)] pl-4 pr-16 text-lg font-semibold outline-none ring-1 ring-[var(--line)] focus:bg-white focus:ring-[var(--accent)]"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--muted)]">
                        {unitLabel}
                      </span>
                    </div>
                  </label>
                </div>
              </article>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="rounded-[1.7rem] bg-white/80 p-8 text-center text-[var(--muted)]">
              По этому поиску товаров нет.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
