"use client";

import { Check, Minus, Plus, ShoppingBasket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AddToCartButtonProps = {
  productId: string;
  name: string;
  price: number;
  unit: string;
  imageUrl?: string | null;
  variant?: "full" | "compact";
  maxQuantity?: number | null;
  disabled?: boolean;
  disabledLabel?: string;
};

export function AddToCartButton({ variant = "full", ...props }: AddToCartButtonProps) {
  const { items, addItem, updateQuantity } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const quantity = items.find((item) => item.productId === props.productId)?.quantity ?? 0;
  const isCompact = variant === "compact";
  const maxQuantity =
    props.maxQuantity === null || props.maxQuantity === undefined
      ? null
      : Math.max(0, props.maxQuantity);
  const reachedLimit = maxQuantity !== null && quantity >= maxQuantity;
  const isDisabled = Boolean(props.disabled) || maxQuantity === 0;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        globalThis.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  function triggerAddedState() {
    setJustAdded(true);

    if (resetTimerRef.current) {
      globalThis.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = globalThis.setTimeout(() => {
      setJustAdded(false);
      resetTimerRef.current = null;
    }, 1400);
  }

  function handleAdd() {
    if (isDisabled || reachedLimit) {
      return;
    }

    addItem(props);
    triggerAddedState();
  }

  function handleIncrease() {
    if (reachedLimit) {
      return;
    }

    updateQuantity(props.productId, quantity + 1);
    triggerAddedState();
  }

  function handleDecrease() {
    updateQuantity(props.productId, quantity - 1);
  }

  if (quantity > 0) {
    return (
      <div
        className={cn(
          "relative flex min-h-11 items-center gap-2 overflow-hidden rounded-2xl bg-[var(--accent)] px-2 text-white shadow-[0_16px_30px_rgba(47,143,79,0.26)] transition-[transform,box-shadow] duration-300",
          isCompact && "min-w-[7.25rem] rounded-[1rem] shadow-[0_12px_24px_rgba(47,143,79,0.2)]",
          justAdded && "shadow-[0_20px_38px_rgba(35,105,58,0.32)]",
        )}
        role="group"
        aria-label={`${props.name} в корзине`}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] bg-white/15 opacity-0",
            justAdded && "animate-[cart-glow_650ms_ease-out]",
          )}
        />

        <button
          type="button"
          onClick={handleDecrease}
          className={cn(
            "relative z-[1] inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/14 transition hover:bg-white/22 active:scale-95",
            isCompact && "h-8 w-8",
          )}
          aria-label={`Уменьшить количество товара ${props.name}`}
        >
          <Minus size={15} />
        </button>

        <div
          className={cn(
            "relative z-[1] flex flex-1 items-center justify-center gap-2",
            justAdded && "animate-[cart-pop_420ms_ease-out]",
          )}
          aria-live="polite"
        >
          {!isCompact && (
            <Check size={15} className={cn("opacity-80 transition", justAdded && "opacity-100")} />
          )}
          <div className="flex flex-col items-center leading-none">
            <span className="text-base font-semibold tabular-nums">{quantity}</span>
            {!isCompact && (
              <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/78">
                в корзине
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleIncrease}
          disabled={reachedLimit}
          className={cn(
            "relative z-[1] inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/14 transition hover:bg-white/22 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45",
            isCompact && "h-8 w-8",
          )}
          aria-label={`Увеличить количество товара ${props.name}`}
        >
          <Plus size={15} />
        </button>
      </div>
    );
  }

  if (isCompact) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        disabled={isDisabled || reachedLimit}
        className="group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-1 ring-[var(--line-strong)] transition hover:-translate-y-0.5 hover:bg-[#d2eacc] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Добавить товар ${props.name} в корзину`}
      >
        <Plus size={20} className="transition-transform group-active:scale-90" />
      </button>
    );
  }

  return (
    <Button
      className="group relative w-full overflow-hidden transition-[transform,box-shadow,background-color] duration-300 active:scale-[0.985]"
      onClick={handleAdd}
      disabled={isDisabled || reachedLimit}
      aria-label={`Добавить товар ${props.name} в корзину`}
    >
      <span className="relative z-[1] flex items-center gap-2 transition-transform duration-300 group-active:scale-[0.98]">
        <ShoppingBasket size={16} className="transition-transform duration-300 group-active:scale-90" />
        <span>{props.disabledLabel ?? (reachedLimit ? "Лимит в корзине" : "В корзину")}</span>
      </span>
    </Button>
  );
}
