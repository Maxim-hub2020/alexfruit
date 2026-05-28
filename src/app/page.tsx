import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MainShell } from "@/components/layout/main-shell";
import { CollectionCartButton } from "@/components/storefront/collection-cart-button";
import { unitLabels } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";
import { getStorefrontData } from "@/lib/orders";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const categoryDescriptions: Record<string, string> = {
  frukty: "Сладкое к завтраку",
  ovoschi: "Основа для ужина",
  zelen: "Зелёный акцент",
  yagody: "Яркий сезон",
  orehi: "Для перекуса",
  suhofrukty: "Полезный запас",
  nabory: "Готовые решения",
  aktsii: "Выгодные предложения",
};

export default async function HomePage() {
  const user = await getCurrentUser();
  const data = await getStorefrontData(user?.role === "CUSTOMER" ? user.id : undefined);

  const heroProduct = data.highlights.popular[0] ?? data.products[0];
  const collections = data.collections;
  const hasPersonalCollections = collections.some(
    (collection) => collection.source === "personal",
  );

  return (
    <MainShell active="home" user={user}>
      <section className="section-shell py-8">
        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative overflow-hidden rounded-[2.75rem] bg-[linear-gradient(135deg,#fffdf7_0%,#eef8e8_52%,#daedd6_100%)] px-6 py-7 shadow-[0_30px_90px_rgba(49,85,60,0.14)] ring-1 ring-white/70 lg:px-8 lg:py-10">
            <div className="absolute -right-10 top-8 h-40 w-40 rounded-full bg-[rgba(255,194,86,0.16)] blur-3xl" />
            <div className="absolute -bottom-10 left-8 h-44 w-44 rounded-full bg-[rgba(47,143,79,0.12)] blur-3xl" />

            <div className="relative space-y-6 md:space-y-7">
              <div className="space-y-4">
                <h1 className="max-w-3xl font-serif text-4xl leading-[1.02] font-semibold text-[var(--foreground)] sm:text-5xl md:text-6xl md:leading-[0.95]">
                  <span className="block">Свежие</span>
                  <span
                    className="hero-word-rotator block text-[clamp(3.4rem,12vw,8.4rem)]"
                    aria-hidden="true"
                  >
                    <span className="hero-word-track block">
                      <span>ФРУКТЫ</span>
                      <span>ОВОЩИ</span>
                      <span>ЯГОДЫ</span>
                    </span>
                  </span>
                  <span className="sr-only">фрукты, овощи и ягоды</span>
                  <span className="block">с доставкой сегодня</span>
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--muted)] md:text-lg md:leading-8">
                  Собирайте корзину на день, на неделю или к семейному ужину: сезонные
                  ягоды, зелень, готовые наборы и понятная доставка без лишней суеты.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/catalog"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(47,143,79,0.26)] transition hover:bg-[var(--accent-strong)]"
                >
                  Открыть каталог
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#collections"
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white/70 px-4 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)] transition hover:bg-white"
                >
                  Посмотреть подборки
                </a>
              </div>

              {user?.role === "CUSTOMER" && (
                <p className="text-sm text-[var(--muted)]">
                  Уже заказывали раньше?{" "}
                  <Link href="/orders" className="font-semibold text-[var(--accent-strong)]">
                    Повторите любимую корзину
                  </Link>{" "}
                  за пару кликов.
                </p>
              )}
            </div>
          </div>

          <aside className="grid gap-4">
            <div className="glass-panel rounded-[2.3rem] p-4">
              <div className="relative overflow-hidden rounded-[1.9rem] bg-[#dbeed8]">
                {heroProduct?.imageUrl ? (
                  <div className="relative h-[320px]">
                    <Image
                      src={heroProduct.imageUrl}
                      alt={heroProduct.name}
                      fill
                      loading="eager"
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 40vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#163023]/75 via-transparent to-transparent" />
                  </div>
                ) : (
                  <div className="flex h-[320px] items-center justify-center bg-[linear-gradient(135deg,#d9ecd5_0%,#edf7ea_100%)] text-7xl">
                    🍏
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <div>
                      <h2 className="font-serif text-4xl font-semibold leading-none">
                        {heroProduct?.name}
                      </h2>
                      <p className="mt-2 text-sm text-white/82">
                        {heroProduct?.description}
                      </p>
                    </div>
                    <div className="rounded-[1.35rem] bg-white/14 px-4 py-3 text-right backdrop-blur-sm">
                      <p className="text-2xl font-semibold">
                        {formatCurrency(Number(heroProduct?.price ?? 0))}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/78">
                        за {unitLabels[heroProduct?.unit ?? ""] ?? heroProduct?.unit}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="section-shell py-3">
        <div className="glass-panel rounded-[2.2rem] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
                Категории на каждый день
              </p>
              <h2 className="mt-2 font-serif text-4xl font-semibold">
                Выберите настроение корзины
              </h2>
            </div>
            <Link href="/catalog" className="text-sm font-semibold text-[var(--accent-strong)]">
              Перейти ко всему каталогу
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.categories.slice(0, 8).map((category) => (
              <Link
                key={category.id}
                href="/catalog"
                className="category-choice-button"
              >
                <span>
                  <h3 className="text-xl font-semibold">{category.name}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {categoryDescriptions[category.slug] ?? "Свежие позиции на каждый день"}
                  </p>
                </span>
                <span className="category-choice-arrow" aria-hidden="true">
                  <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="relative my-2 overflow-hidden py-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[linear-gradient(180deg,rgba(245,248,240,0)_0%,rgba(216,237,211,0.68)_48%,rgba(245,248,240,0)_100%)] blur-sm" />

        <section id="collections" className="section-shell relative py-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
                {hasPersonalCollections ? "Подобрано под вас" : "Быстрые сценарии"}
              </p>
              <h2 className="mt-2 font-serif text-4xl font-semibold">
                Подборки, с которых удобно начать
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                {hasPersonalCollections
                  ? "Система смотрит на ваши прошлые покупки и собирает корзины, которые можно добавить одним нажатием."
                  : "Пока истории покупок мало, показываем готовые стартовые корзины."}
              </p>
            </div>
            <Link href="/catalog" className="text-sm font-semibold text-[var(--accent-strong)]">
              Открыть весь каталог
            </Link>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {collections.map((collection, index) => {
              const cover = collection.items[0];

              return (
                <article
                  key={collection.key}
                  className="relative overflow-hidden rounded-[2.2rem] bg-[linear-gradient(180deg,#ffffff_0%,#f1f7ef_100%)] p-5 ring-1 ring-[var(--line)] shadow-[0_18px_50px_rgba(61,93,74,0.09)]"
                >
                  <div className="absolute -right-8 top-10 h-24 w-24 rounded-full bg-[rgba(47,143,79,0.09)] blur-2xl" />
                  <div className="relative">
                    <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                      {collection.eyebrow}
                    </p>
                    <h3 className="mt-3 text-3xl font-semibold">{collection.title}</h3>
                    <p className="mt-3 max-w-md text-sm leading-7 text-[var(--muted)]">
                      {collection.text}
                    </p>

                    <div className="mt-5 flex items-center gap-4 rounded-[1.7rem] bg-white/86 p-4">
                      <div className="relative h-24 w-24 overflow-hidden rounded-[1.3rem] bg-[var(--surface-muted)]">
                        {cover?.imageUrl ? (
                          <Image
                            src={cover.imageUrl}
                            alt={cover.name}
                            fill
                            className="object-cover"
                            sizes="96px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-4xl">
                            {index === 0 ? "🍊" : index === 1 ? "🍓" : "🥬"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="mt-2 truncate text-lg font-semibold">{cover?.name}</p>
                        <p className="mt-1 text-sm text-[var(--accent-strong)]">
                          {formatCurrency(Number(cover?.price ?? 0))}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-2">
                      {collection.items.map((item) => (
                        <div
                          key={item.productId}
                          className="flex items-center justify-between rounded-[1.25rem] bg-white/72 px-4 py-3 text-sm"
                        >
                          <span className="font-medium">{item.name}</span>
                          <span className="text-[var(--muted)]">
                            {formatCurrency(Number(item.price))}
                          </span>
                        </div>
                      ))}
                    </div>

                    <CollectionCartButton items={collection.items} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <section className="section-shell py-6">
        <div className="rounded-[2.4rem] bg-[linear-gradient(135deg,#214e31_0%,#2f8f4f_100%)] px-6 py-7 text-white shadow-[0_24px_70px_rgba(25,66,40,0.2)] lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.24em] text-white/70">
                Честно и удобно
              </p>
              <h2 className="mt-3 font-serif text-4xl font-semibold">
                Весовые товары уточним после сборки, а адрес и любимые позиции сохраним
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/78">
                Так вы видите реальный итог по овощам и фруктам, а следующий заказ занимает
                уже заметно меньше времени.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/catalog"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold transition hover:bg-white/90"
                style={{ color: "#23693a" }}
              >
                Перейти к покупкам
              </Link>
              <Link
                href={user ? "/orders" : "/login"}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/22 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/16"
              >
                {user ? "Мои заказы" : "Войти и сохранить адрес"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MainShell>
  );
}
