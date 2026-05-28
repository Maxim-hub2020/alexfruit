"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { CartLine } from "@/components/providers/cart-provider";
import { useCart } from "@/components/providers/cart-provider";
import { cn } from "@/lib/utils";

function mergeCartItems(currentItems: CartLine[], collectionItems: CartLine[]) {
  const merged = new Map<string, CartLine>();

  for (const item of currentItems) {
    merged.set(item.productId, item);
  }

  for (const item of collectionItems) {
    const current = merged.get(item.productId);

    if (!current) {
      merged.set(item.productId, item);
      continue;
    }

    merged.set(item.productId, {
      ...current,
      quantity: current.quantity + item.quantity,
    });
  }

  return [...merged.values()];
}

export function CollectionCartButton({
  items,
  className,
}: {
  items: CartLine[];
  className?: string;
}) {
  const router = useRouter();
  const { items: currentItems, hydrated, replaceAll } = useCart();
  const [isPending, startTransition] = useTransition();
  const isDisabled = !hydrated || isPending || items.length === 0;

  function handleClick() {
    if (isDisabled) {
      return;
    }

    replaceAll(mergeCartItems(currentItems, items));
    startTransition(() => {
      router.push("/cart");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        "mt-5 inline-flex items-center gap-2 rounded-full text-sm font-semibold text-[var(--accent-strong)] transition hover:gap-3 disabled:opacity-60",
        className,
      )}
    >
      {isPending ? "Собираем корзину" : "Собрать корзину"}
      <ArrowRight size={15} />
    </button>
  );
}
