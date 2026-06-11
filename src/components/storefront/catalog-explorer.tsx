"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import {
  Apple,
  BadgePercent,
  Carrot,
  CircleDot,
  Leaf,
  MoreVertical,
  PackageOpen,
  Search,
  SlidersHorizontal,
  Sparkles,
  ShoppingBasket,
} from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { ProductCard } from "@/components/storefront/product-card";
import { CatalogImage } from "@/components/ui/catalog-image";
import { cn, formatCurrency } from "@/lib/utils";

type CatalogProduct = {
  id: string;
  name: string;
  price: number | string;
  unit: string;
  imageUrl?: string | null;
  description?: string | null;
  isHit: boolean;
  isNew: boolean;
  isPromo: boolean;
  hasDailyInventory?: boolean;
  availableQuantity?: number | null;
  isAvailableForDate?: boolean;
  averageRating?: number | null;
  reviewsCount?: number;
  category: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
  };
};

type AvailabilityFilter = "all" | "today" | "preorder" | "promo";

const categoryIcons = {
  frukty: Apple,
  ovoschi: Carrot,
  kartofel: CircleDot,
  zelen: Leaf,
  yagody: CircleDot,
  griby: PackageOpen,
  orehi: CircleDot,
  suhofrukty: Sparkles,
  ekzotika: Sparkles,
  nabory: PackageOpen,
  aktsii: BadgePercent,
} as const;

const availabilityFilters: Array<{ value: AvailabilityFilter; label: string }> = [
  { value: "all", label: "Все товары" },
  { value: "today", label: "В наличии" },
  { value: "preorder", label: "Под заказ" },
  { value: "promo", label: "Акции и хиты" },
];

function isAvailableToday(product: CatalogProduct) {
  return product.isAvailableForDate === true && Number(product.availableQuantity ?? 0) > 0;
}

function isPreorderProduct(product: CatalogProduct) {
  return product.isAvailableForDate === false;
}

function isPromotedProduct(product: CatalogProduct) {
  return product.isPromo || product.isHit || product.isNew;
}

export function CatalogExplorer({
  categories,
  products,
}: {
  categories: Array<{ id: string; name: string; slug: string; imageUrl?: string | null }>;
  products: CatalogProduct[];
}) {
  const firstCategorySlug = categories[0]?.slug ?? null;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(() => firstCategorySlug);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("all");
  const deferredQuery = useDeferredValue(query);
  const { count, subtotal, hydrated } = useCart();

  const activeCategorySlug = category ?? firstCategorySlug;
  const selectedCategory = useMemo(
    () => categories.find((item) => item.slug === activeCategorySlug) ?? null,
    [activeCategorySlug, categories],
  );

  const categoryProductCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const product of products) {
      counts.set(product.category.slug, (counts.get(product.category.slug) ?? 0) + 1);
    }

    return counts;
  }, [products]);

  const availabilityFilterCounts = useMemo(
    () => ({
      all: products.length,
      today: products.filter(isAvailableToday).length,
      preorder: products.filter(isPreorderProduct).length,
      promo: products.filter(isPromotedProduct).length,
    }),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        !activeCategorySlug || product.category.slug === activeCategorySlug;
      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "today" && isAvailableToday(product)) ||
        (availabilityFilter === "preorder" && isPreorderProduct(product)) ||
        (availabilityFilter === "promo" && isPromotedProduct(product));
      const matchesQuery =
        normalizedQuery.length === 0 ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        (product.description ?? "").toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesAvailability && matchesQuery;
    });
  }, [activeCategorySlug, availabilityFilter, deferredQuery, products]);

  const activeFilterLabel =
    availabilityFilters.find((filter) => filter.value === availabilityFilter)?.label ??
    "Фильтр";

  return (
    <div className="w-full max-w-full overflow-hidden rounded-[2rem] bg-white/86 px-3 py-4 shadow-[0_30px_90px_rgba(61,93,74,0.12)] ring-1 ring-white/80 sm:px-5 lg:px-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-semibold leading-none md:text-5xl">
            Каталог
          </h1>
          <p className="max-w-xl text-sm leading-6 text-[var(--muted)] max-sm:hidden">
            Свежие овощи, фрукты, ягоды и сезонные позиции для быстрой корзины.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-[22rem]">
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по товарам"
                className="h-12 w-full rounded-2xl bg-[var(--surface-muted)] pl-11 pr-4 text-sm outline-none ring-1 ring-[var(--line)] transition focus:bg-white focus:ring-[var(--accent)]"
              />
            </label>
            <button
              type="button"
              onClick={() => setIsFilterOpen((current) => !current)}
              className={cn(
                "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold ring-1 transition",
                isFilterOpen || availabilityFilter !== "all"
                  ? "bg-[var(--accent)] text-white ring-[var(--accent)]"
                  : "bg-white text-[var(--foreground)] ring-[var(--line)] hover:bg-[var(--surface-muted)]",
              )}
              aria-expanded={isFilterOpen}
            >
              <SlidersHorizontal size={17} />
              <span className="hidden sm:inline">{activeFilterLabel}</span>
            </button>
          </div>

          {isFilterOpen && (
            <div className="rounded-[1.5rem] bg-white p-3 shadow-[0_18px_48px_rgba(61,93,74,0.10)] ring-1 ring-[var(--line)]">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Фильтр
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {availabilityFilters.map((filter) => {
                  const isActive = availabilityFilter === filter.value;
                  const filterCount = availabilityFilterCounts[filter.value];

                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setAvailabilityFilter(filter.value)}
                      className={cn(
                        "rounded-full px-3 py-2 text-xs font-semibold transition ring-1",
                        isActive
                          ? "bg-[var(--accent)] text-white ring-[var(--accent)]"
                          : "bg-[var(--surface-muted)] text-[var(--muted)] ring-[var(--line)] hover:bg-white hover:text-[var(--foreground)]",
                      )}
                    >
                      {filter.label}
                      <span className="ml-1 opacity-75">{filterCount}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="sticky top-20 z-20 -mx-3 mt-5 border-y border-white/80 bg-white/76 px-3 py-3 backdrop-blur-xl sm:-mx-5 sm:px-5 md:top-24 lg:-mx-7 lg:px-7">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((item) => {
            const Icon = categoryIcons[item.slug as keyof typeof categoryIcons] ?? CircleDot;
            const isActive = activeCategorySlug === item.slug;
            const productsCount = categoryProductCounts.get(item.slug) ?? 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.slug)}
                className={cn(
                  "group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ring-1",
                  isActive
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-[var(--accent-soft)] shadow-sm"
                    : "bg-white/64 text-[var(--muted)] ring-transparent hover:bg-white hover:text-[var(--foreground)]",
                )}
              >
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[var(--accent-strong)]">
                  {item.imageUrl ? (
                    <CatalogImage
                      src={item.imageUrl}
                      alt=""
                      fill
                      className="object-contain p-1"
                      sizes="28px"
                    />
                  ) : (
                    <Icon size={15} />
                  )}
                </span>
                <span className="whitespace-nowrap">{item.name}</span>
                <span className="rounded-full bg-white/64 px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                  {productsCount}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 pb-24 md:pb-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Товары
            </p>
            <h2 className="mt-1 font-serif text-3xl font-semibold md:text-4xl">
              {selectedCategory ? selectedCategory.name : "Результаты поиска"}
            </h2>
          </div>
          <p className="text-sm text-[var(--muted)]">
            {filteredProducts.length} товаров
          </p>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} variant="catalog" />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.5rem] bg-[var(--surface-muted)] p-8 text-center text-[var(--muted)]">
            По этому запросу товаров пока нет.
          </div>
        )}
      </section>

      {hydrated && count > 0 ? (
        <Link
          href="/cart"
          className="fixed inset-x-4 bottom-24 z-40 mx-auto flex min-h-16 max-w-md items-center gap-3 rounded-[1.45rem] bg-[var(--accent)] px-5 text-white shadow-[0_24px_60px_rgba(35,105,58,0.34)] ring-1 ring-white/40 md:bottom-8"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/16">
            <ShoppingBasket size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">Корзина</span>
            <span className="block text-xs text-white/76">
              {count} поз. в заказе
            </span>
          </span>
          <span className="text-lg font-bold">{formatCurrency(subtotal)}</span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/14">
            <MoreVertical size={20} />
          </span>
        </Link>
      ) : null}
    </div>
  );
}
