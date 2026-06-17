import Link from "next/link";
import { Flame, Sparkles, Star, Tag } from "lucide-react";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { CatalogImage } from "@/components/ui/catalog-image";
import { unitLabels } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

type ProductCardProps = {
  product: {
    id: string;
    name: string;
    price: number | string | { toString(): string };
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
  };
  variant?: "default" | "catalog";
};

function ProductBadges({ product, compact = false }: {
  product: ProductCardProps["product"];
  compact?: boolean;
}) {
  const hasBadges = product.isHit || product.isNew || product.isPromo;
  const badgeClass = compact
    ? "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold shadow-sm"
    : "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shadow-sm";

  if (!hasBadges) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {product.isHit && (
        <span className={`${badgeClass} bg-white/88 text-[var(--foreground)]`}>
          <Flame size={compact ? 10 : 12} />
          Хит
        </span>
      )}
      {product.isNew && (
        <span className={`${badgeClass} bg-emerald-100/95 text-emerald-900`}>
          <Sparkles size={compact ? 10 : 12} />
          Новинка
        </span>
      )}
      {product.isPromo && (
        <span className={`${badgeClass} bg-orange-100/95 text-orange-900`}>
          <Tag size={compact ? 10 : 12} />
          Акция
        </span>
      )}
    </div>
  );
}

function ProductRating({ product }: { product: ProductCardProps["product"] }) {
  const rating = product.averageRating ?? null;
  const reviewsCount = product.reviewsCount ?? 0;
  const roundedRating = rating ? Math.round(rating) : 0;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
      <span
        className="flex items-center gap-0.5"
        aria-label={rating ? `Рейтинг ${rating}` : "Пока нет отзывов"}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            size={14}
            className={
              index < roundedRating
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-[var(--line)]"
            }
          />
        ))}
      </span>
      <span>
        {rating ? `${rating.toFixed(1)} · ${reviewsCount}` : "Нет отзывов"}
      </span>
    </div>
  );
}

export function ProductCard({ product, variant = "default" }: ProductCardProps) {
  const isAvailableForDate = product.isAvailableForDate !== false;
  const isPreorder = !isAvailableForDate;
  const availabilityLabel =
    isPreorder
      ? "Под заказ"
      : product.hasDailyInventory && product.availableQuantity !== null
        ? `В наличии: ${product.availableQuantity}`
        : "В наличии";

  if (variant === "catalog") {
    return (
      <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[1.35rem] bg-white/82 ring-1 ring-[var(--line)] transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_18px_42px_rgba(61,93,74,0.10)]">
        <Link
          href={`/products/${product.id}`}
          className="relative block aspect-square overflow-hidden rounded-[1.2rem] bg-white"
          aria-label={`Открыть карточку товара ${product.name}`}
        >
          {product.imageUrl ? (
            <CatalogImage
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-contain p-2 transition duration-500 group-hover:scale-[1.02]"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">🍎</div>
          )}
        </Link>

        <div className="flex min-h-[11.75rem] flex-1 flex-col px-2.5 pb-3 pt-2.5 sm:px-3">
          <Link
            href={`/products/${product.id}`}
            className="line-clamp-2 text-[0.92rem] font-bold leading-5 tracking-[-0.02em] transition hover:text-[var(--accent-strong)] sm:text-base"
          >
            {product.name}
          </Link>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
            {product.description || "Свежая поставка с ежедневным обновлением."}
          </p>
          <ProductBadges product={product} compact />

          <div className="mt-auto space-y-2 pt-2.5">
            <span className="block text-[11px] font-semibold text-[var(--accent-strong)]">
              {availabilityLabel}
            </span>
            <div className="flex items-center justify-between gap-2">
              <div className="shrink-0 whitespace-nowrap rounded-full bg-[#eef7e8] px-3 py-2 text-[13px] font-black text-[var(--accent-strong)] ring-1 ring-[rgba(47,143,79,0.10)] sm:text-sm">
                {formatCurrency(product.price)}
                <span className="ml-1 text-[10px] font-semibold text-[var(--muted)]">
                  за {unitLabels[product.unit] ?? product.unit}
                </span>
              </div>
              <AddToCartButton
                productId={product.id}
                name={product.name}
                price={Number(product.price)}
                unit={product.unit}
                imageUrl={product.imageUrl}
                variant="compact"
                maxQuantity={isPreorder ? null : product.availableQuantity}
                isPreorder={isPreorder}
              />
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="soft-card w-full max-w-full overflow-hidden rounded-[2rem]">
      <Link
        href={`/products/${product.id}`}
        className="relative block h-52 bg-white"
        aria-label={`Открыть карточку товара ${product.name}`}
      >
        {product.imageUrl ? (
          <CatalogImage
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-contain p-3"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">🍎</div>
        )}
      </Link>

      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/products/${product.id}`}
              className="text-lg font-semibold transition hover:text-[var(--accent-strong)]"
            >
              {product.name}
            </Link>
            <div className="shrink-0 whitespace-nowrap text-right">
              <p className="text-lg font-bold text-[var(--accent-strong)]">
                {formatCurrency(product.price)}
              </p>
              <p className="text-xs text-[var(--muted)]">
                за {unitLabels[product.unit] ?? product.unit}
              </p>
            </div>
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">
            {product.description || "Свежая поставка с ежедневным обновлением."}
          </p>
          <ProductBadges product={product} />
          <ProductRating product={product} />
          <p className="text-xs font-semibold text-[var(--accent-strong)]">
            {availabilityLabel}
          </p>
          <Link
            href={`/products/${product.id}`}
            className="inline-flex text-sm font-semibold text-[var(--muted)] underline-offset-4 transition hover:text-[var(--accent-strong)] hover:underline"
          >
            Описание и отзывы
          </Link>
        </div>

        <AddToCartButton
          productId={product.id}
          name={product.name}
          price={Number(product.price)}
          unit={product.unit}
          imageUrl={product.imageUrl}
          maxQuantity={isPreorder ? null : product.availableQuantity}
          isPreorder={isPreorder}
          disabledLabel={isPreorder ? "Добавить под заказ" : undefined}
        />
      </div>
    </article>
  );
}
