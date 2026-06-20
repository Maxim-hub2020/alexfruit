"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Search,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogImage } from "@/components/ui/catalog-image";
import { unitLabels } from "@/lib/constants";
import { cn } from "@/lib/utils";

type AssemblyOrder = {
  id: string;
  status: string;
  items: Array<{
    id: string;
    productId?: string | null;
    productName: string;
    orderedQuantity: number | string;
    actualQuantity?: number | string | null;
    unit?: string;
    isPreorder?: boolean;
    product?: {
      imageUrl?: string | null;
      category?: {
        name: string;
        slug?: string | null;
        sortOrder?: number | null;
      } | null;
    } | null;
  }>;
};

type ProductSummary = {
  key: string;
  itemId: string;
  productName: string;
  categoryName: string;
  categorySlug: string;
  categorySortOrder: number;
  imageUrl?: string | null;
  unit?: string;
  quantity: number;
  actualQuantity: number;
  orders: Set<string>;
  isPreorder: boolean;
};

type ProductSummaryGroup = {
  key: string;
  name: string;
  sortOrder: number;
  items: ProductSummary[];
};

type SummaryFilter = "all" | "available" | "missing";
type ProductSummaryStatus = "available" | "low" | "missing";

const assemblyStatuses = new Set([
  "NEW",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "ASSEMBLING",
]);

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildProductSummary(orders: AssemblyOrder[]) {
  const summary = new Map<string, ProductSummary>();

  for (const order of orders) {
    if (!assemblyStatuses.has(order.status)) {
      continue;
    }

    for (const item of order.items) {
      const key = item.productId ?? item.productName;
      const current = summary.get(key);
      const quantity = toNumber(item.orderedQuantity);
      const actualQuantity = toNumber(item.actualQuantity ?? item.orderedQuantity);
      const category = item.product?.category;

      if (current) {
        current.quantity += quantity;
        current.actualQuantity += actualQuantity;
        current.orders.add(order.id);
        current.isPreorder = current.isPreorder || Boolean(item.isPreorder);
        continue;
      }

      summary.set(key, {
        key,
        itemId: item.id,
        productName: item.productName,
        categoryName: category?.name ?? "Без категории",
        categorySlug: category?.slug ?? "uncategorized",
        categorySortOrder: category?.sortOrder ?? 999,
        imageUrl: item.product?.imageUrl ?? null,
        unit: item.unit,
        quantity,
        actualQuantity,
        orders: new Set([order.id]),
        isPreorder: Boolean(item.isPreorder),
      });
    }
  }

  return [...summary.values()].sort((first, second) =>
    first.categorySortOrder === second.categorySortOrder
      ? first.productName.localeCompare(second.productName, "ru")
      : first.categorySortOrder - second.categorySortOrder,
  );
}

function groupProductSummary(products: ProductSummary[]) {
  const groups = new Map<string, ProductSummaryGroup>();

  for (const product of products) {
    const current =
      groups.get(product.categorySlug) ??
      {
        key: product.categorySlug,
        name: product.categoryName,
        sortOrder: product.categorySortOrder,
        items: [],
      };

    current.items.push(product);
    groups.set(product.categorySlug, current);
  }

  return [...groups.values()].sort((first, second) =>
    first.sortOrder === second.sortOrder
      ? first.name.localeCompare(second.name, "ru")
      : first.sortOrder - second.sortOrder,
  );
}

function getProductFallbackIcon(productName: string) {
  const normalized = productName.toLowerCase();

  if (/(клубник|малин|ежевик|голубик|ягод|череш|вишн)/.test(normalized)) {
    return "🍒";
  }

  if (/(помидор|томат|перец|огур|баклажан|капуст|овощ|брокколи)/.test(normalized)) {
    return "🥬";
  }

  if (/(картоф|морков|свекл|лук|чеснок)/.test(normalized)) {
    return "🥔";
  }

  if (/(арбуз|дын|яблок|груш|слив|нектар|фрукт)/.test(normalized)) {
    return "🍎";
  }

  return "🥗";
}

function formatQuantity(value: number, unit?: string) {
  const quantity = Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

  return `${quantity} ${unit ? unitLabels[unit] ?? unit : ""}`.trim();
}

function zoneLetter(index: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return alphabet[index] ?? `${index + 1}`;
}

function getProductStatus(product: ProductSummary): ProductSummaryStatus {
  if (product.actualQuantity <= 0) {
    return "missing";
  }

  if (product.actualQuantity < product.quantity) {
    return "low";
  }

  return "available";
}

function getStatusLabel(product: ProductSummary) {
  const status = getProductStatus(product);

  if (status === "missing") {
    return "Отсутствует";
  }

  if (status === "low") {
    return "Мало";
  }

  return "В наличии";
}

function getStatusHint(product: ProductSummary) {
  if (getProductStatus(product) !== "low") {
    return "";
  }

  return `Осталось ${formatQuantity(product.actualQuantity, product.unit)}`;
}

function getStatusClass(product: ProductSummary) {
  const status = getProductStatus(product);

  if (status === "missing") {
    return "bg-rose-50 text-rose-700 ring-rose-100";
  }

  if (status === "low") {
    return "bg-amber-50 text-amber-800 ring-amber-100";
  }

  return "bg-emerald-50 text-emerald-700 ring-emerald-100";
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
  const [filter, setFilter] = useState<SummaryFilter>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [isPending, startTransition] = useTransition();
  const products = useMemo(() => buildProductSummary(orders), [orders]);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const status = getProductStatus(product);
        const matchesFilter =
          filter === "all" ||
          (filter === "available" && status !== "missing") ||
          (filter === "missing" && status === "missing");
        const matchesQuery =
          normalizedQuery.length === 0 ||
          product.productName.toLowerCase().includes(normalizedQuery) ||
          product.categoryName.toLowerCase().includes(normalizedQuery);

        return matchesFilter && matchesQuery;
      }),
    [filter, normalizedQuery, products],
  );
  const groups = useMemo(() => groupProductSummary(filteredProducts), [filteredProducts]);
  const stats = useMemo(() => {
    const totalKg = products.reduce(
      (sum, product) => (product.unit === "KG" ? sum + product.quantity : sum),
      0,
    );
    const availableCount = products.filter(
      (product) => getProductStatus(product) !== "missing",
    ).length;
    const missingCount = products.filter(
      (product) => getProductStatus(product) === "missing",
    ).length;
    const assembledOrdersCount = orders.filter((order) => order.status === "ASSEMBLED").length;
    const progressPercent =
      orders.length > 0 ? Math.round((assembledOrdersCount / orders.length) * 100) : 0;

    return {
      totalKg,
      availableCount,
      missingCount,
      progressPercent,
    };
  }, [orders, products]);

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
    <section className="glass-panel overflow-hidden rounded-[2rem] p-0">
      <div className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Список для сборщика
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Товары к сборке</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              Сводный список по всем активным заказам выбранной даты. Если товара нет
              в хорошем качестве, отметьте его отсутствующим прямо из строки.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <AlertTriangle size={16} />
            Уведомления уйдут клиентам по всем активным заказам
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-[1.25rem] bg-emerald-50 p-4 text-sm text-emerald-900">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-[1.25rem] bg-rose-50 p-4 text-sm text-rose-900">
            {error}
          </div>
        ) : null}
      </div>

      <div className="border-y border-[var(--line)] bg-white/74 p-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all" as const, label: "Все зоны", count: products.length },
              { value: "available" as const, label: "Только в наличии", count: stats.availableCount },
              { value: "missing" as const, label: "Отсутствуют", count: stats.missingCount },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold ring-1 transition",
                  filter === item.value
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-[rgba(47,143,79,0.18)]"
                    : "bg-white text-[var(--muted)] ring-[var(--line)] hover:text-[var(--foreground)]",
                )}
              >
                {item.label}
                <span className="rounded-full bg-white/82 px-2 py-0.5 text-[10px] text-[var(--accent-strong)]">
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          <label className="relative block min-w-0 lg:w-72">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по товару"
              className="h-10 w-full rounded-full bg-white pl-11 pr-4 text-sm outline-none ring-1 ring-[var(--line)] transition focus:ring-[var(--accent)]"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-[var(--line)] md:grid-cols-4">
        <div className="bg-white/90 p-4">
          <p className="text-2xl font-bold">{products.length}</p>
          <p className="text-xs text-[var(--muted)]">Товар</p>
        </div>
        <div className="bg-white/90 p-4">
          <p className="text-2xl font-bold">{formatQuantity(stats.totalKg, "KG")}</p>
          <p className="text-xs text-[var(--muted)]">Всего к сборке</p>
        </div>
        <div className="bg-white/90 p-4">
          <p className="text-2xl font-bold">{orders.length}</p>
          <p className="text-xs text-[var(--muted)]">Заказов</p>
        </div>
        <div className="bg-white/90 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--muted)]">Прогресс сборки</p>
            <p className="text-sm font-bold text-[var(--accent-strong)]">
              {stats.progressPercent}%
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef4ea]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="divide-y divide-[var(--line)] bg-white/82">
        {groups.map((group, groupIndex) => {
          const groupKg = group.items.reduce(
            (sum, item) => (item.unit === "KG" ? sum + item.quantity : sum),
            0,
          );

          return (
            <section key={group.key}>
              <header className="flex items-center justify-between gap-3 bg-[#f7fbf4] px-3 py-2 text-xs font-semibold text-[var(--accent-strong)] sm:px-4">
                <span className="inline-flex items-center gap-2">
                  <MapPin size={14} />
                  Зона {zoneLetter(groupIndex)} · {group.name}
                </span>
                <span className="text-[var(--muted)]">
                  {group.items.length} товара
                  {groupKg > 0 ? ` · ${formatQuantity(groupKg, "KG")}` : ""}
                </span>
              </header>

              <div className="divide-y divide-[var(--line)]">
                {group.items.map((product) => (
                  <div
                    key={product.key}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2.5 transition hover:bg-[#fbfdf8] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:px-4"
                  >
                    <div className="relative h-10 w-10 overflow-hidden rounded-2xl bg-[#f2f7ed] ring-1 ring-[var(--line)]">
                      {product.imageUrl ? (
                        <CatalogImage
                          src={product.imageUrl}
                          alt={product.productName}
                          fill
                          className="object-contain p-1"
                          sizes="40px"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-lg">
                          {getProductFallbackIcon(product.productName)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{product.productName}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {formatQuantity(product.quantity, product.unit)} · {product.orders.size}{" "}
                        заказ(а)
                        {product.isPreorder ? " · под заказ" : ""}
                      </p>
                    </div>

                    <div className="hidden min-w-16 text-right text-sm font-bold sm:block">
                      {formatQuantity(product.quantity, product.unit)}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                          getStatusClass(product),
                        )}
                      >
                        {getProductStatus(product) === "available" ? (
                          <CheckCircle2 size={12} />
                        ) : null}
                        {getStatusLabel(product)}
                      </span>
                      {getStatusHint(product) ? (
                        <span className="text-[10px] text-[var(--muted)]">
                          {getStatusHint(product)}
                        </span>
                      ) : null}
                    </div>

                    <Button
                      variant="ghost"
                      className="h-9 w-9 gap-1 rounded-full p-0 text-xs text-rose-700 ring-1 ring-rose-100 hover:bg-rose-50 sm:w-auto sm:px-3"
                      disabled={busyKey === product.key || isPending}
                      onClick={() => markUnavailable(product)}
                      aria-label={`Отметить ${product.productName} отсутствующим`}
                    >
                      <Send size={13} />
                      <span className="hidden sm:inline">
                        {busyKey === product.key ? "..." : "Нет товара"}
                      </span>
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {groups.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            На выбранную дату нет товаров в активной сборке.
          </div>
        ) : null}
      </div>

      <footer className="flex flex-col gap-3 bg-white/90 p-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" className="justify-center rounded-2xl bg-white ring-1 ring-[var(--line)]">
          Приостановить сборку
        </Button>
        <p className="text-center text-sm font-semibold text-[var(--accent-strong)]">
          Собрано: {formatQuantity(stats.totalKg, "KG")} из {formatQuantity(stats.totalKg, "KG")}
        </p>
        <Button className="justify-center rounded-2xl">
          Продолжить сборку
        </Button>
      </footer>
    </section>
  );
}
