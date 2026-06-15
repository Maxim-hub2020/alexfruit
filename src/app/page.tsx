import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Clock3,
  Search,
  ShoppingBasket,
  Sparkles,
  Truck,
} from "lucide-react";
import { MainShell } from "@/components/layout/main-shell";
import { CollectionCartButton } from "@/components/storefront/collection-cart-button";
import { ProductCard } from "@/components/storefront/product-card";
import { CatalogImage } from "@/components/ui/catalog-image";
import { unitLabels } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";
import { getStorefrontData } from "@/lib/orders";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const categoryDescriptions: Record<string, string> = {
  frukty: "Фрукты",
  ovoschi: "Овощи",
  kartofel: "Картофель",
  zelen: "Зелень",
  yagody: "Ягоды",
  griby: "Грибы",
  ekzotika: "Экзотика",
  orehi: "Орехи",
  suhofrukty: "Сухофрукты",
  nabory: "Наборы",
  aktsii: "Акции",
};

const promoCards = [
  {
    title: "Свежая поставка",
    text: "Сезонные позиции обновляем каждый день.",
    href: "/catalog",
    icon: Sparkles,
    className: "bg-[#dfeec9]",
  },
  {
    title: "Быстрая корзина",
    text: "Выберите товары, а дату доставки укажете при оформлении.",
    href: "/catalog",
    icon: ShoppingBasket,
    className: "bg-[#f7e7bd]",
  },
  {
    title: "Хиты и акции",
    text: "Собрали выгодные позиции в одном фильтре.",
    href: "/catalog",
    icon: BadgePercent,
    className: "bg-[#e1eefc]",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const data = await getStorefrontData(user?.role === "CUSTOMER" ? user.id : undefined);

  const heroProduct = data.highlights.popular[0] ?? data.products[0];
  const featuredProducts =
    data.highlights.popular.length > 0
      ? data.highlights.popular.slice(0, 6)
      : data.products.slice(0, 6);
  const collections = data.collections.slice(0, 3);
  const hasPersonalCollections = collections.some(
    (collection) => collection.source === "personal",
  );

  return (
    <MainShell active="home" user={user}>
      <section className="section-shell pb-3 pt-4 md:pt-6">
        <div className="lavka-home-shell">
          <div className="lavka-home-top">
            <div className="min-w-0 space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/78 px-3 py-1.5 text-xs font-semibold text-[var(--accent-strong)] ring-1 ring-white/80">
                <Truck size={14} />
                Ростов-на-Дону, свежая доставка
              </p>

              <div>
                <h1 className="max-w-3xl text-4xl font-black leading-[0.94] tracking-[-0.065em] sm:text-6xl lg:text-7xl">
                  Овощи, фрукты и ягоды без лишней суеты
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
                  Выбирайте как в удобной лавке: категории рядом, товары крупно,
                  корзина всегда под рукой, а доставка настраивается только при
                  оформлении заказа.
                </p>
              </div>

              <Link href="/catalog" className="lavka-home-search">
                <Search size={18} />
                <span className="min-w-0 flex-1 truncate">
                  Найти клубнику, помидоры или зелень
                </span>
                <ArrowRight size={18} />
              </Link>
            </div>

            <Link
              href={heroProduct ? `/products/${heroProduct.id}` : "/catalog"}
              className="lavka-hero-product"
            >
              <div className="relative h-56 overflow-hidden rounded-[2rem] bg-white sm:h-72">
                {heroProduct?.imageUrl ? (
                  <CatalogImage
                    src={heroProduct.imageUrl}
                    alt={heroProduct.name}
                    fill
                    loading="eager"
                    className="object-contain p-4"
                    sizes="(max-width: 1024px) 100vw, 34vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-7xl">🍓</div>
                )}
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Популярно сегодня
                  </p>
                  <h2 className="mt-1 line-clamp-2 text-xl font-black tracking-[-0.04em]">
                    {heroProduct?.name ?? "Свежая поставка"}
                  </h2>
                </div>
                <div className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-black text-white">
                  {formatCurrency(Number(heroProduct?.price ?? 0))}
                  <span className="ml-1 text-[10px] font-semibold text-white/75">
                    за {unitLabels[heroProduct?.unit ?? ""] ?? heroProduct?.unit}
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <div className="lavka-promo-row">
            {promoCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link key={card.title} href={card.href} className={`lavka-promo-card ${card.className}`}>
                  <span className="lavka-promo-icon">
                    <Icon size={18} />
                  </span>
                  <strong>{card.title}</strong>
                  <span>{card.text}</span>
                </Link>
              );
            })}
          </div>

          <div className="lavka-category-home">
            {data.categories.slice(0, 10).map((category) => (
              <Link
                key={category.id}
                href={`/catalog?category=${category.slug}`}
                className="lavka-category-home__item"
              >
                <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.35rem] bg-white">
                  {category.imageUrl ? (
                    <CatalogImage
                      src={category.imageUrl}
                      alt=""
                      fill
                      className="object-contain p-2"
                      sizes="64px"
                    />
                  ) : (
                    <span className="text-3xl">🥬</span>
                  )}
                </span>
                <span className="text-sm font-bold">
                  {categoryDescriptions[category.slug] ?? category.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell py-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              <Clock3 size={14} />
              Быстрый выбор
            </p>
            <h2 className="mt-1 text-3xl font-black tracking-[-0.045em] md:text-5xl">
              Популярное сейчас
            </h2>
          </div>
          <Link
            href="/catalog"
            className="hidden rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--accent-strong)] ring-1 ring-[var(--line)] transition hover:bg-[var(--surface-muted)] sm:inline-flex"
          >
            Весь каталог
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} variant="catalog" />
          ))}
        </div>
      </section>

      <section id="collections" className="section-shell py-4">
        <div className="rounded-[2rem] bg-white/72 p-4 shadow-[0_20px_70px_rgba(61,93,74,0.09)] ring-1 ring-white/82 sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                {hasPersonalCollections ? "Подобрано под вас" : "Готовые корзины"}
              </p>
              <h2 className="mt-1 text-3xl font-black tracking-[-0.045em]">
                Подборки для быстрого старта
              </h2>
            </div>
            <Link href="/catalog" className="text-sm font-bold text-[var(--accent-strong)]">
              Открыть весь каталог
            </Link>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {collections.map((collection, index) => {
              const cover = collection.items[0];

              return (
                <article
                  key={collection.key}
                  className="rounded-[1.7rem] bg-[linear-gradient(180deg,#ffffff_0%,#f2f8ee_100%)] p-4 ring-1 ring-[var(--line)]"
                >
                  <div className="flex gap-3">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[1.35rem] bg-white">
                      {cover?.imageUrl ? (
                        <CatalogImage
                          src={cover.imageUrl}
                          alt={cover.name}
                          fill
                          className="object-contain p-2"
                          sizes="96px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl">
                          {index === 0 ? "🍊" : index === 1 ? "🍓" : "🥬"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                        {collection.eyebrow}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-xl font-black tracking-[-0.04em]">
                        {collection.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                        {collection.text}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {collection.items.slice(0, 3).map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between rounded-[1rem] bg-white/72 px-3 py-2 text-sm"
                      >
                        <span className="truncate font-semibold">{item.name}</span>
                        <span className="ml-3 shrink-0 text-[var(--muted)]">
                          {formatCurrency(Number(item.price))}
                        </span>
                      </div>
                    ))}
                  </div>

                  <CollectionCartButton items={collection.items} />
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </MainShell>
  );
}
