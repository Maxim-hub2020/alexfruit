"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  MapPin,
  PackageCheck,
  Phone,
  Scale,
  Search,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogImage } from "@/components/ui/catalog-image";
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
    product?: {
      imageUrl?: string | null;
      category?: {
        name: string;
        slug: string;
        sortOrder?: number | null;
      } | null;
    } | null;
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

type SummaryFilter = "all" | "available" | "missing";

type ProductSummary = {
  key: string;
  productName: string;
  categoryName: string;
  categorySlug: string;
  categorySortOrder: number;
  imageUrl?: string | null;
  unit: string;
  orderedQuantity: number;
  actualQuantity: number;
  ordersCount: number;
  orderIds: string[];
  isPreorder: boolean;
};

type ProductSummaryStatus = "available" | "low" | "missing";

type ProductSummaryGroup = {
  key: string;
  name: string;
  sortOrder: number;
  items: ProductSummary[];
};

function quantityToInput(value: number | string | null | undefined, fallback: number | string) {
  return String(Number(value ?? fallback));
}

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseQuantity(value: string) {
  const numeric = Number(value.trim().replace(",", "."));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function formatQuantity(value: number, unit: string) {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${rounded} ${unitLabels[unit] ?? unit}`;
}

function getProductFallbackIcon(productName: string) {
  const normalized = productName.toLowerCase();

  if (/(клубник|малин|ежевик|голубик|ягод|череш|вишн)/.test(normalized)) {
    return "🍒";
  }

  if (/(помидор|томат|перец|огур|баклажан|капуст|овощ)/.test(normalized)) {
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

function getProductSummaryStatus(summary: ProductSummary): ProductSummaryStatus {
  if (summary.actualQuantity <= 0) {
    return "missing";
  }

  if (summary.actualQuantity < summary.orderedQuantity) {
    return "low";
  }

  return "available";
}

function productStatusLabel(summary: ProductSummary) {
  const status = getProductSummaryStatus(summary);

  if (status === "missing") {
    return "Отсутствует";
  }

  if (status === "low") {
    return `Осталось ${formatQuantity(summary.actualQuantity, summary.unit)}`;
  }

  return "В наличии";
}

function productStatusClass(summary: ProductSummary) {
  const status = getProductSummaryStatus(summary);

  if (status === "missing") {
    return "bg-rose-50 text-rose-700 ring-rose-100";
  }

  if (status === "low") {
    return "bg-amber-50 text-amber-800 ring-amber-100";
  }

  return "bg-emerald-50 text-emerald-700 ring-emerald-100";
}

function zoneLetter(index: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return alphabet[index] ?? `${index + 1}`;
}

function buildProductSummary(orders: PickerOrder[], quantities: Record<string, string>) {
  const summaryMap = new Map<string, ProductSummary>();

  for (const order of orders) {
    for (const item of order.items) {
      const key = item.productId ?? `name:${item.productName.toLowerCase()}`;
      const orderedQuantity = toNumber(item.orderedQuantity);
      const actualQuantity =
        parseQuantity(quantities[item.id] ?? "") ??
        toNumber(item.actualQuantity ?? item.orderedQuantity);
      const category = item.product?.category;
      const current =
        summaryMap.get(key) ??
        {
          key,
          productName: item.productName,
          categoryName: category?.name ?? "Без категории",
          categorySlug: category?.slug ?? "uncategorized",
          categorySortOrder: category?.sortOrder ?? 999,
          imageUrl: item.product?.imageUrl ?? null,
          unit: item.unit,
          orderedQuantity: 0,
          actualQuantity: 0,
          ordersCount: 0,
          orderIds: [],
          isPreorder: false,
        };

      current.orderedQuantity += orderedQuantity;
      current.actualQuantity += actualQuantity;
      current.isPreorder = current.isPreorder || Boolean(item.isPreorder);

      if (!current.orderIds.includes(order.id)) {
        current.orderIds.push(order.id);
        current.ordersCount += 1;
      }

      summaryMap.set(key, current);
    }
  }

  return [...summaryMap.values()].sort((a, b) =>
    a.categorySortOrder === b.categorySortOrder
      ? a.productName.localeCompare(b.productName, "ru")
      : a.categorySortOrder - b.categorySortOrder,
  );
}

function groupProductSummary(items: ProductSummary[]) {
  const groupMap = new Map<string, ProductSummaryGroup>();

  for (const item of items) {
    const current =
      groupMap.get(item.categorySlug) ??
      {
        key: item.categorySlug,
        name: item.categoryName,
        sortOrder: item.categorySortOrder,
        items: [],
      };

    current.items.push(item);
    groupMap.set(item.categorySlug, current);
  }

  return [...groupMap.values()].sort((a, b) =>
    a.sortOrder === b.sortOrder
      ? a.name.localeCompare(b.name, "ru")
      : a.sortOrder - b.sortOrder,
  );
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
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>("all");
  const [summaryQuery, setSummaryQuery] = useState("");
  const deferredSummaryQuery = useDeferredValue(summaryQuery);
  const [, startTransition] = useTransition();
  const assemblyUrl = `/api/admin/orders/assembly-pdf?date=${encodeURIComponent(date)}`;
  const labelsUrl = `/api/admin/orders/labels?date=${encodeURIComponent(date)}`;
  const productSummary = useMemo(
    () => buildProductSummary(orders, quantities),
    [orders, quantities],
  );
  const normalizedSummaryQuery = deferredSummaryQuery.trim().toLowerCase();
  const filteredSummary = useMemo(
    () =>
      productSummary.filter((summary) => {
        const status = getProductSummaryStatus(summary);
        const matchesFilter =
          summaryFilter === "all" ||
          (summaryFilter === "available" && status !== "missing") ||
          (summaryFilter === "missing" && status === "missing");
        const matchesQuery =
          normalizedSummaryQuery.length === 0 ||
          summary.productName.toLowerCase().includes(normalizedSummaryQuery) ||
          summary.categoryName.toLowerCase().includes(normalizedSummaryQuery);

        return matchesFilter && matchesQuery;
      }),
    [normalizedSummaryQuery, productSummary, summaryFilter],
  );
  const summaryGroups = useMemo(() => groupProductSummary(filteredSummary), [filteredSummary]);
  const stats = useMemo(() => {
    const itemsCount = orders.reduce((sum, order) => sum + order.items.length, 0);
    const preorderCount = orders.reduce(
      (sum, order) => sum + order.items.filter((item) => item.isPreorder).length,
      0,
    );
    const totalKg = productSummary.reduce(
      (sum, item) => (item.unit === "KG" ? sum + item.orderedQuantity : sum),
      0,
    );
    const availableCount = productSummary.filter(
      (item) => getProductSummaryStatus(item) !== "missing",
    ).length;
    const missingCount = productSummary.filter(
      (item) => getProductSummaryStatus(item) === "missing",
    ).length;
    const assembledOrdersCount = orders.filter((order) => order.status === "ASSEMBLED").length;
    const progressPercent =
      orders.length > 0 ? Math.round((assembledOrdersCount / orders.length) * 100) : 0;

    return {
      itemsCount,
      preorderCount,
      productsCount: productSummary.length,
      totalKg,
      availableCount,
      missingCount,
      progressPercent,
    };
  }, [orders, productSummary]);

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

        <div className="mt-5 overflow-hidden rounded-[1.7rem] bg-white/82 ring-1 ring-[var(--line)]">
          <div className="grid gap-3 border-b border-[var(--line)] p-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all" as const, label: "Все зоны", count: stats.productsCount },
                { value: "available" as const, label: "Только в наличии", count: stats.availableCount },
                { value: "missing" as const, label: "Отсутствуют", count: stats.missingCount },
              ].map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setSummaryFilter(filter.value)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold ring-1 transition",
                    summaryFilter === filter.value
                      ? "bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-[rgba(47,143,79,0.18)]"
                      : "bg-white text-[var(--muted)] ring-[var(--line)] hover:text-[var(--foreground)]",
                  )}
                >
                  {filter.label}
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-[var(--accent-strong)]">
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>

            <label className="relative block min-w-0 md:w-72">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                value={summaryQuery}
                onChange={(event) => setSummaryQuery(event.target.value)}
                placeholder="Поиск по товару"
                className="h-10 w-full rounded-full bg-white pl-11 pr-4 text-sm outline-none ring-1 ring-[var(--line)] transition focus:ring-[var(--accent)]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-px bg-[var(--line)] sm:grid-cols-4">
            <div className="bg-white/90 p-4">
              <p className="text-2xl font-bold">{stats.productsCount}</p>
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

          <div className="divide-y divide-[var(--line)]">
            {summaryGroups.map((group, groupIndex) => {
              const totalGroupKg = group.items.reduce(
                (sum, item) => (item.unit === "KG" ? sum + item.orderedQuantity : sum),
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
                      {totalGroupKg > 0 ? ` · ${formatQuantity(totalGroupKg, "KG")}` : ""}
                    </span>
                  </header>

                  <div className="divide-y divide-[var(--line)]">
                    {group.items.map((summary) => (
                      <div
                        key={summary.key}
                        className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-[#fbfdf8] sm:px-4"
                      >
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-[#f2f7ed] ring-1 ring-[var(--line)]">
                          {summary.imageUrl ? (
                            <CatalogImage
                              src={summary.imageUrl}
                              alt={summary.productName}
                              fill
                              className="object-contain p-1"
                              sizes="40px"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-lg">
                              {getProductFallbackIcon(summary.productName)}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{summary.productName}</p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {formatQuantity(summary.orderedQuantity, summary.unit)} ·{" "}
                            {summary.ordersCount} заказ(а)
                          </p>
                        </div>

                        <div className="hidden min-w-16 text-right text-sm font-bold sm:block">
                          {formatQuantity(summary.orderedQuantity, summary.unit)}
                        </div>

                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                            productStatusClass(summary),
                          )}
                        >
                          {getProductSummaryStatus(summary) === "available" ? (
                            <CheckCircle2 size={12} />
                          ) : null}
                          {productStatusLabel(summary)}
                        </span>

                        <ChevronRight size={16} className="hidden text-[var(--muted)] sm:block" />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}

            {summaryGroups.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                По выбранному фильтру товары не найдены.
              </div>
            ) : null}
          </div>
        </div>
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
