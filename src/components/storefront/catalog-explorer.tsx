"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Apple,
  BadgePercent,
  Carrot,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Leaf,
  PackageOpen,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { CatalogImage } from "@/components/ui/catalog-image";
import { unitLabels } from "@/lib/constants";
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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("all");
  const deferredQuery = useDeferredValue(query);

  const heroProducts = useMemo(() => {
    const withImages = products.filter((product) => product.imageUrl);
    return (withImages.length > 0 ? withImages : products).slice(0, 4);
  }, [products]);

  const activeHero = heroProducts[heroIndex % Math.max(heroProducts.length, 1)];
  const seasonalProducts = useMemo(() => {
    const highlighted = products.filter((product) => product.isNew || product.isPromo);
    return (highlighted.length > 0 ? highlighted : products).slice(0, 4);
  }, [products]);
  const selectedCategory = useMemo(
    () => categories.find((item) => item.slug === category) ?? null,
    [categories, category],
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
      const matchesCategory = !category || product.category.slug === category;
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
  }, [availabilityFilter, category, deferredQuery, products]);
  const isCategoryLanding =
    !category && deferredQuery.trim().length === 0 && availabilityFilter === "all";
  const activeFilterLabel =
    availabilityFilters.find((filter) => filter.value === availabilityFilter)?.label ??
    "Фильтр";

  function showPreviousHero() {
    if (heroProducts.length === 0) {
      return;
    }

    setHeroIndex((current) => (current - 1 + heroProducts.length) % heroProducts.length);
  }

  function showNextHero() {
    if (heroProducts.length === 0) {
      return;
    }

    setHeroIndex((current) => (current + 1) % heroProducts.length);
  }

  function returnToCategories() {
    setCategory(null);
    setQuery("");
    setAvailabilityFilter("all");
  }

  return (
    <div className="rounded-[2.35rem] bg-white px-4 py-5 shadow-[0_30px_90px_rgba(61,93,74,0.12)] ring-1 ring-white/80 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <h1 className="font-serif text-4xl font-semibold leading-none md:text-5xl">
            Каталог
          </h1>
          <p className="max-w-xl text-sm leading-6 text-[var(--muted)]">
            Фрукты, овощи, ягоды и готовые наборы для быстрой корзины по Ростову-на-Дону.
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
                  const count = availabilityFilterCounts[filter.value];

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
                      <span className="ml-1 opacity-75">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="hidden">
        <div className="flex gap-6 overflow-x-auto border-b border-[var(--line)] pb-2">
          <button
            type="button"
            onClick={returnToCategories}
            className={cn(
              "group flex min-w-[4.8rem] flex-col items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition",
              !category
                ? "border-[var(--accent)] text-[var(--accent-strong)]"
                : "border-transparent text-[var(--muted)]",
            )}
          >
            <Sparkles size={30} className="transition group-hover:text-[var(--accent-strong)]" />
            Категории
          </button>
          {categories.map((item) => {
            const Icon = categoryIcons[item.slug as keyof typeof categoryIcons] ?? CircleDot;
            const isActive = category === item.slug;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.slug)}
                className={cn(
                  "group flex min-w-[5.4rem] flex-col items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition",
                  isActive
                    ? "border-[var(--accent)] text-[var(--accent-strong)]"
                    : "border-transparent text-[var(--muted)]",
                )}
              >
                <Icon size={30} className="transition group-hover:text-[var(--accent-strong)]" />
                {item.name}
              </button>
            );
          })}
        </div>
      </section>

      {isCategoryLanding ? (
        <section className="mt-7">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                Категории
              </p>
              <h2 className="mt-1 font-serif text-4xl font-semibold">
                Выберите раздел
              </h2>
            </div>
            <p className="hidden text-sm text-[var(--muted)] sm:block">
              {categories.length} разделов
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {categories.map((item) => {
              const Icon = categoryIcons[item.slug as keyof typeof categoryIcons] ?? CircleDot;
              const productsCount = categoryProductCounts.get(item.slug) ?? 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.slug)}
                  className="group rounded-[1.35rem] bg-[var(--surface-muted)] p-3 text-left ring-1 ring-[var(--line)] transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_18px_48px_rgba(61,93,74,0.12)] sm:p-4"
                >
                  <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[1rem] bg-white text-[var(--accent-strong)] ring-1 ring-[var(--line)] transition group-hover:bg-[var(--accent-soft)] sm:h-12 sm:w-12">
                    {item.imageUrl ? (
                      <CatalogImage
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <Icon size={24} />
                    )}
                  </span>
                  <span className="mt-3 block text-base font-semibold leading-tight sm:text-lg">
                    {item.name}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--muted)] sm:text-sm">
                    {productsCount} товаров
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="mt-7">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <button
                type="button"
                onClick={returnToCategories}
                className="mb-3 inline-flex items-center gap-2 rounded-2xl bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--line)] transition hover:bg-white"
              >
                <ChevronLeft size={16} />
                Назад к категориям
              </button>
              <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                Товары
              </p>
              <h2 className="mt-1 font-serif text-4xl font-semibold">
                {selectedCategory ? selectedCategory.name : "Результаты поиска"}
              </h2>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {filteredProducts.length} товаров
            </p>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
      )}

      {!isCategoryLanding && (
      <section className="mt-8">
        <div className="mb-4">
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
            Подборки и предложения
          </p>
          <h2 className="mt-1 font-serif text-4xl font-semibold">Для быстрой корзины</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,#f8fbf5_0%,#ecf5e7_100%)]">
          <div className="absolute right-5 top-5 z-[2] flex gap-2">
            <button
              type="button"
              onClick={showPreviousHero}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/86 text-[var(--accent-strong)] shadow-sm ring-1 ring-[var(--line)]"
              aria-label="Предыдущее предложение"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={showNextHero}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/86 text-[var(--accent-strong)] shadow-sm ring-1 ring-[var(--line)]"
              aria-label="Следующее предложение"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="relative h-[22rem] sm:h-[25rem]">
            {activeHero?.imageUrl ? (
              <CatalogImage
                src={activeHero.imageUrl}
                alt={activeHero.name}
                fill
                loading="eager"
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-8xl">🍓</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <div className="max-w-md rounded-[1.8rem] bg-white/88 p-4 shadow-[0_18px_48px_rgba(61,93,74,0.12)] backdrop-blur-md">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                  Сегодня в корзину
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{activeHero?.name}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {activeHero?.description ?? "Свежая позиция из ежедневной поставки."}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-2xl font-bold text-[var(--accent-strong)]">
                      {formatCurrency(Number(activeHero?.price ?? 0))}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      за {unitLabels[activeHero?.unit ?? ""] ?? activeHero?.unit}
                    </p>
                  </div>
                  {activeHero ? (
                    <AddToCartButton
                      productId={activeHero.id}
                      name={activeHero.name}
                      price={Number(activeHero.price)}
                      unit={activeHero.unit}
                      imageUrl={activeHero.imageUrl}
                      variant="compact"
                      maxQuantity={
                        activeHero.isAvailableForDate === false
                          ? null
                          : activeHero.availableQuantity
                      }
                      isPreorder={activeHero.isAvailableForDate === false}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
            {heroProducts.map((product, index) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setHeroIndex(index)}
                className={cn(
                  "h-2 rounded-full transition",
                  index === heroIndex ? "w-7 bg-[var(--accent)]" : "w-2 bg-[var(--line-strong)]",
                )}
                aria-label={`Показать ${product.name}`}
              />
            ))}
          </div>
        </div>

        <aside className="rounded-[2rem] bg-[#f1f7ee] p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Сезонные предложения
          </p>
          <div className="mt-4 grid gap-3">
            {seasonalProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  const nextHeroIndex = heroProducts.findIndex((item) => item.id === product.id);
                  if (nextHeroIndex >= 0) {
                    setHeroIndex(nextHeroIndex);
                  }
                }}
                className="flex items-center gap-3 rounded-[1.35rem] bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[1rem] bg-[var(--surface-muted)]">
                  {product.imageUrl ? (
                    <CatalogImage
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl">🍎</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{product.name}</p>
                  <p className="mt-1 text-sm text-[var(--accent-strong)]">
                    {formatCurrency(product.price)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </aside>
        </div>
      </section>
      )}
    </div>
  );
}
