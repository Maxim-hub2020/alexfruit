"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Apple,
  BadgePercent,
  Carrot,
  CircleDot,
  Flame,
  Leaf,
  PackageOpen,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Truck,
} from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { CatalogImage } from "@/components/ui/catalog-image";
import { cn } from "@/lib/utils";

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
type SpotlightFilter = "all" | "hit" | "popular" | "discount";

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
  { value: "all", label: "Все статусы" },
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

function isPopularProduct(product: CatalogProduct) {
  return product.isHit || product.isPromo || (product.reviewsCount ?? 0) > 0;
}

function matchesSpotlightFilter(product: CatalogProduct, filter: SpotlightFilter) {
  return (
    filter === "all" ||
    (filter === "hit" && product.isHit) ||
    (filter === "popular" && isPopularProduct(product)) ||
    (filter === "discount" && product.isPromo)
  );
}

export function CatalogExplorer({
  categories,
  compactHome = false,
  initialCategory,
  products,
}: {
  categories: Array<{ id: string; name: string; slug: string; imageUrl?: string | null }>;
  compactHome?: boolean;
  initialCategory?: string | null;
  products: CatalogProduct[];
}) {
  const initialCategorySlug =
    initialCategory && categories.some((item) => item.slug === initialCategory)
      ? initialCategory
      : null;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(initialCategorySlug);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("all");
  const [spotlightFilter, setSpotlightFilter] = useState<SpotlightFilter>("all");
  const deferredQuery = useDeferredValue(query);

  const activeCategorySlug = category;
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

  const homePickTiles = useMemo(() => {
    const hitProducts = products.filter((product) => product.isHit);
    const popularProducts = products
      .filter(isPopularProduct)
      .sort((left, right) => {
        const rightScore = Number(right.reviewsCount ?? 0) + (right.isHit ? 10 : 0);
        const leftScore = Number(left.reviewsCount ?? 0) + (left.isHit ? 10 : 0);

        return rightScore - leftScore;
      });
    const discountProducts = products.filter((product) => product.isPromo);

    return [
      {
        value: "hit" as const,
        title: "Хит",
        description: "То, что чаще всего забирают первым",
        count: hitProducts.length,
        products: hitProducts,
        icon: Flame,
        className: "lavka-pick-tile--hero",
      },
      {
        value: "popular" as const,
        title: "Самое покупаемое",
        description: "Проверенные позиции на каждый день",
        count: popularProducts.length,
        products: popularProducts,
        icon: TrendingUp,
        className: "lavka-pick-tile--tall",
      },
      {
        value: "discount" as const,
        title: "Скидки",
        description: "Выгодные предложения и спеццены",
        count: discountProducts.length,
        products: discountProducts,
        icon: BadgePercent,
        className: "lavka-pick-tile--compact",
      },
    ];
  }, [products]);

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

      return (
        matchesCategory &&
        matchesAvailability &&
        matchesQuery &&
        matchesSpotlightFilter(product, spotlightFilter)
      );
    });
  }, [activeCategorySlug, availabilityFilter, deferredQuery, products, spotlightFilter]);

  const activeFilterLabel =
    availabilityFilters.find((filter) => filter.value === availabilityFilter)?.label ??
    "Фильтр";
  const todayProductsCount = availabilityFilterCounts.today;
  const preorderProductsCount = availabilityFilterCounts.preorder;
  const promotedProductsCount = availabilityFilterCounts.promo;

  return (
    <div className={cn("lavka-storefront-shell", compactHome && "lavka-storefront-shell--home")}>
      {!compactHome && (
        <section className="lavka-market-head">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/76 px-3 py-1.5 text-xs font-semibold text-[var(--accent-strong)] ring-1 ring-white/80">
              <Truck size={14} />
              Доставка по Ростову-на-Дону
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
              Что положим в корзину?
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Свежие овощи, фрукты, ягоды и сезонные позиции в понятной витрине.
            </p>
          </div>

          <div className="lavka-market-head__stats">
            <button
              type="button"
              onClick={() => {
                setAvailabilityFilter("today");
                setSpotlightFilter("all");
                setIsFilterOpen(false);
              }}
              className="lavka-stat-card bg-[#eff8e8]"
            >
              <span>{todayProductsCount}</span>
              <small>можно сегодня</small>
            </button>
            <button
              type="button"
              onClick={() => {
                setAvailabilityFilter("preorder");
                setSpotlightFilter("all");
                setIsFilterOpen(false);
              }}
              className="lavka-stat-card bg-[#fff4df]"
            >
              <span>{preorderProductsCount}</span>
              <small>под заказ</small>
            </button>
            <button
              type="button"
              onClick={() => {
                setAvailabilityFilter("promo");
                setSpotlightFilter("all");
                setIsFilterOpen(false);
              }}
              className="lavka-stat-card bg-[#eef5ff]"
            >
              <span>{promotedProductsCount}</span>
              <small>хиты и акции</small>
            </button>
          </div>
        </section>
      )}

      <section className={cn("lavka-search-dock", compactHome && "lavka-search-dock--first")}>
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти ягоды, овощи или зелень"
              className="h-12 w-full rounded-[1.15rem] bg-white pl-11 pr-4 text-sm outline-none ring-1 ring-[var(--line)] transition focus:ring-[var(--accent)]"
            />
          </label>
          <button
            type="button"
            onClick={() => setIsFilterOpen((current) => !current)}
            className={cn(
              "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold ring-1 transition",
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
          <div className="mt-3 rounded-[1.4rem] bg-white p-3 shadow-[0_18px_48px_rgba(61,93,74,0.10)] ring-1 ring-[var(--line)]">
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
                    onClick={() => {
                      setAvailabilityFilter(filter.value);
                      setSpotlightFilter("all");
                    }}
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
      </section>

      {compactHome && (
        <section className="lavka-home-picks" aria-label="Подборки">
          {homePickTiles.map((tile) => {
            const Icon = tile.icon;
            const tileProducts =
              tile.products.length > 0 ? tile.products.slice(0, 3) : products.slice(0, 3);
            const isActive = spotlightFilter === tile.value;

            return (
              <button
                key={tile.value}
                type="button"
                onClick={() => {
                  setSpotlightFilter(tile.value);
                  setCategory(null);
                  setIsFilterOpen(false);
                }}
                className={cn(
                  "lavka-pick-tile",
                  tile.className,
                  isActive && "lavka-pick-tile--active",
                )}
              >
                <span className="lavka-pick-tile__top">
                  <span className="lavka-pick-tile__icon">
                    <Icon size={16} />
                  </span>
                  <span>{tile.count > 0 ? `${tile.count} поз.` : "скоро"}</span>
                </span>
                <strong>{tile.title}</strong>
                <small>{tile.description}</small>
                <span className="lavka-pick-tile__images" aria-hidden="true">
                  {tileProducts.map((product) => (
                    <span
                      key={`${tile.value}-${product.id}`}
                      className="lavka-pick-tile__image"
                    >
                      {product.imageUrl ? (
                        <CatalogImage
                          src={product.imageUrl}
                          alt=""
                          fill
                          sizes="72px"
                          className="object-contain"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-lg">🍎</span>
                      )}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </section>
      )}

      <section className="lavka-category-strip">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => {
              setCategory(null);
              setSpotlightFilter("all");
            }}
            className={cn(
              "group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ring-1",
              activeCategorySlug === null
                ? "bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-[var(--accent-soft)] shadow-sm"
                : "bg-white/64 text-[var(--muted)] ring-transparent hover:bg-white hover:text-[var(--foreground)]",
            )}
          >
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[var(--accent-strong)]">
              <PackageOpen size={15} />
            </span>
            <span className="whitespace-nowrap">Все товары</span>
            <span className="rounded-full bg-white/64 px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
              {products.length}
            </span>
          </button>
          {categories.map((item) => {
            const Icon = categoryIcons[item.slug as keyof typeof categoryIcons] ?? CircleDot;
            const isActive = activeCategorySlug === item.slug;
            const productsCount = categoryProductCounts.get(item.slug) ?? 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCategory(item.slug);
                  setSpotlightFilter("all");
                }}
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

      <section className={cn("mt-5 pb-24 md:pb-10", compactHome && "mt-3")}>
        {!compactHome && (
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.04em] md:text-4xl">
                {selectedCategory ? selectedCategory.name : "Все товары"}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {filteredProducts.length} позиций
              </p>
            </div>
          </div>
        )}

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
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

    </div>
  );
}
