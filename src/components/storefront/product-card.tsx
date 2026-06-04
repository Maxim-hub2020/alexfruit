import Image from "next/image";
import { Clock3, Flame, Sparkles, Star, Tag } from "lucide-react";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { unitLabels } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

type ProductCardProps = {
  product: {
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
  };
  variant?: "default" | "catalog";
};

function ProductBadges({ product }: { product: ProductCardProps["product"] }) {
  return (
    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
      {product.isHit && (
        <span className="rounded-full bg-white/88 px-3 py-1 text-xs font-semibold text-[var(--foreground)] shadow-sm">
          <Flame className="mr-1 inline-block" size={12} />
          Хит
        </span>
      )}
      {product.isNew && (
        <span className="rounded-full bg-emerald-100/95 px-3 py-1 text-xs font-semibold text-emerald-900 shadow-sm">
          <Sparkles className="mr-1 inline-block" size={12} />
          Новинка
        </span>
      )}
      {product.isPromo && (
        <span className="rounded-full bg-orange-100/95 px-3 py-1 text-xs font-semibold text-orange-900 shadow-sm">
          <Tag className="mr-1 inline-block" size={12} />
          Акция
        </span>
      )}
      {product.isAvailableForDate === false && (
        <span className="rounded-full bg-amber-100/95 px-3 py-1 text-xs font-semibold text-amber-900 shadow-sm">
          <Clock3 className="mr-1 inline-block" size={12} />
          Под заказ
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
      <span className="flex items-center gap-0.5" aria-label={rating ? `Рейтинг ${rating}` : "Пока нет отзывов"}>
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
      <article className="group overflow-hidden rounded-[1.6rem] bg-white shadow-[0_18px_42px_rgba(61,93,74,0.1)] ring-1 ring-[var(--line)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(61,93,74,0.14)]">
        <div className="relative h-44 bg-[#edf5e9]">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover transition duration-500 group-hover:scale-[1.04]"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl">🍎</div>
          )}
          <ProductBadges product={product} />
        </div>

        <div className="space-y-3 p-4">
          <div className="min-h-[5rem]">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold leading-6">{product.name}</h3>
              <p className="shrink-0 text-lg font-bold text-[var(--accent-strong)]">
                {formatCurrency(product.price)}
              </p>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              за {unitLabels[product.unit] ?? product.unit}
            </p>
            <div className="mt-2">
              <ProductRating product={product} />
            </div>
            <p className="mt-2 text-sm leading-5 text-[var(--muted)]">
              {product.description || "Свежая поставка с ежедневным обновлением."}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
            <span className="text-xs font-semibold text-[var(--accent-strong)]">
              {availabilityLabel}
            </span>
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
      </article>
    );
  }

  return (
    <article className="soft-card overflow-hidden rounded-[2rem]">
      <div className="relative h-52 bg-[var(--surface-muted)]">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">🍎</div>
        )}
        <ProductBadges product={product} />
      </div>

      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold">{product.name}</h3>
            <div className="text-right">
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
          <ProductRating product={product} />
          <p className="text-xs font-semibold text-[var(--accent-strong)]">
            {availabilityLabel}
          </p>
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
