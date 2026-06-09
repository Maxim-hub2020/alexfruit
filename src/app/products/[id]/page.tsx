import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageCircle, Star } from "lucide-react";
import { MainShell } from "@/components/layout/main-shell";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { ProductCard } from "@/components/storefront/product-card";
import { CatalogImage } from "@/components/ui/catalog-image";
import { unitLabels } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessDateKey } from "@/lib/delivery-rules";
import { prisma } from "@/lib/db";
import { addDailyAvailabilityToProducts } from "@/lib/inventory";
import { addReviewSummaryToProducts } from "@/lib/reviews";
import { formatCurrency, formatDateLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

function RatingStars({
  rating,
  size = 20,
}: {
  rating: number | null;
  size?: number;
}) {
  const roundedRating = rating ? Math.round(rating) : 0;

  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={rating ? `Рейтинг ${rating} из 5` : "Пока нет отзывов"}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={size}
          className={
            index < roundedRating
              ? "fill-amber-400 text-amber-400"
              : "fill-none text-[var(--line-strong)]"
          }
        />
      ))}
    </span>
  );
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Клиент";
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const [user, product] = await Promise.all([
    getCurrentUser(),
    prisma.product.findFirst({
      where: {
        id,
        isActive: true,
      },
      include: {
        category: true,
        reviews: {
          where: {
            isPublished: true,
          },
          include: {
            photos: true,
            user: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);

  if (!product) {
    notFound();
  }

  const deliveryDate = getBusinessDateKey();
  const [productWithAvailability] = await addReviewSummaryToProducts(
    await addDailyAvailabilityToProducts([product], deliveryDate),
  );
  const relatedProductsRaw = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      isActive: true,
      NOT: { id: product.id },
    },
    include: {
      category: true,
    },
    orderBy: [{ isHit: "desc" }, { isPromo: "desc" }, { createdAt: "desc" }],
    take: 3,
  });
  const relatedProducts = await addReviewSummaryToProducts(
    await addDailyAvailabilityToProducts(relatedProductsRaw, deliveryDate),
  );
  const isPreorder = productWithAvailability.isAvailableForDate === false;
  const availabilityLabel = isPreorder
    ? "Под заказ"
    : productWithAvailability.hasDailyInventory &&
        productWithAvailability.availableQuantity !== null
      ? `В наличии: ${productWithAvailability.availableQuantity}`
      : "В наличии";
  const averageRating = productWithAvailability.averageRating;
  const reviewsCount = productWithAvailability.reviewsCount ?? 0;

  return (
    <MainShell active="catalog" user={user}>
      <section className="section-shell space-y-6 py-6">
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--line)] transition hover:bg-white"
        >
          <ChevronLeft size={16} />
          Назад в каталог
        </Link>

        <article className="glass-panel overflow-hidden rounded-[2.6rem] p-4 md:p-6">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative min-h-[22rem] overflow-hidden rounded-[2rem] bg-[var(--surface-muted)] md:min-h-[32rem]">
              {productWithAvailability.imageUrl ? (
                <CatalogImage
                  src={productWithAvailability.imageUrl}
                  alt={productWithAvailability.name}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 48vw"
                />
              ) : (
                <div className="flex h-full min-h-[22rem] items-center justify-center text-8xl">
                  🍎
                </div>
              )}
              <div className="absolute left-4 top-4 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] shadow-sm">
                {productWithAvailability.category.name}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-6 p-2 md:p-4">
              <div className="space-y-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                    Карточка товара
                  </p>
                  <h1 className="mt-3 font-serif text-5xl font-semibold leading-none md:text-6xl">
                    {productWithAvailability.name}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <RatingStars rating={averageRating} size={22} />
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {averageRating ? averageRating.toFixed(1) : "Нет оценок"}
                  </span>
                  <a
                    href="#reviews"
                    className="text-sm font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline"
                  >
                    {reviewsCount} отзывов
                  </a>
                </div>

                <div className="rounded-[1.6rem] bg-white/86 p-5 ring-1 ring-[var(--line)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Описание
                  </p>
                  <p className="mt-3 text-base leading-8 text-[var(--foreground)]">
                    {productWithAvailability.description ||
                      "Свежая позиция из ежедневной поставки АлексФрут. Мы проверяем качество перед сборкой и бережно упаковываем заказ перед доставкой."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.4rem] bg-[#f5f8ef] p-4">
                    <p className="text-xs text-[var(--muted)]">Цена</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--accent-strong)]">
                      {formatCurrency(productWithAvailability.price)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      за {unitLabels[productWithAvailability.unit] ?? productWithAvailability.unit}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] bg-[#f5f8ef] p-4">
                    <p className="text-xs text-[var(--muted)]">Статус</p>
                    <p className="mt-2 text-lg font-semibold">{availabilityLabel}</p>
                    <p className="text-xs text-[var(--muted)]">
                      на ближайшую доставку
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.6rem] bg-white/86 p-4 ring-1 ring-[var(--line)]">
                <AddToCartButton
                  productId={productWithAvailability.id}
                  name={productWithAvailability.name}
                  price={Number(productWithAvailability.price)}
                  unit={productWithAvailability.unit}
                  imageUrl={productWithAvailability.imageUrl}
                  maxQuantity={
                    isPreorder ? null : productWithAvailability.availableQuantity
                  }
                  isPreorder={isPreorder}
                  disabledLabel={
                    isPreorder ? "Добавить под заказ" : undefined
                  }
                />
              </div>
            </div>
          </div>
        </article>

        <section id="reviews" className="space-y-4">
          <div className="glass-panel rounded-[2.1rem] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                  Отзывы покупателей
                </p>
                <h2 className="mt-2 font-serif text-4xl font-semibold">
                  Что говорят о товаре
                </h2>
              </div>
              <div className="rounded-[1.5rem] bg-white/86 px-4 py-3 ring-1 ring-[var(--line)]">
                <div className="flex items-center gap-3">
                  <RatingStars rating={averageRating} size={20} />
                  <span className="text-sm font-semibold">
                    {averageRating ? averageRating.toFixed(1) : "Пока нет оценок"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {productWithAvailability.reviews.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {productWithAvailability.reviews.map((review) => (
                <article
                  key={review.id}
                  className="glass-panel rounded-[1.9rem] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {getFirstName(review.user.name)}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {formatDateLabel(review.createdAt)}
                      </p>
                    </div>
                    <RatingStars rating={review.rating} size={18} />
                  </div>

                  {review.comment ? (
                    <p className="mt-4 text-base leading-8 text-[var(--foreground)]">
                      {review.comment}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      Покупатель оставил оценку без комментария.
                    </p>
                  )}

                  {review.photos.length > 0 ? (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {review.photos.map((photo) => (
                        <a
                          key={photo.id}
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="relative h-24 overflow-hidden rounded-[1.1rem] ring-1 ring-[var(--line)]"
                        >
                          <CatalogImage
                            src={photo.url}
                            alt="Фото из отзыва"
                            fill
                            className="object-cover transition hover:scale-105"
                            sizes="120px"
                          />
                        </a>
                      ))}
                    </div>
                  ) : null}

                  {review.adminReply ? (
                    <div className="mt-4 rounded-[1.35rem] bg-[#f5f8ef] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)]">
                        <MessageCircle size={16} />
                        Ответ АлексФрут
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {review.adminReply}
                      </p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="glass-panel rounded-[1.9rem] p-8 text-center">
              <p className="text-xl font-semibold">Отзывов пока нет</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Станьте первым покупателем, который поделится впечатлением после
                доставки.
              </p>
            </div>
          )}
        </section>

        {relatedProducts.length > 0 ? (
          <section className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                Ещё из категории
              </p>
              <h2 className="mt-2 font-serif text-4xl font-semibold">
                Похожие товары
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id}
                  product={relatedProduct}
                  variant="catalog"
                />
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </MainShell>
  );
}
