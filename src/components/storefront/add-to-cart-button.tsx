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
  isPreorder?: boolean;
};

export function AddToCartButton({ variant = "full", ...props }: AddToCartButtonProps) {
  const { items, addItem, updateQuantity } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const compactControlsRef = useRef<HTMLDivElement | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const quantity = items.find((item) => item.productId === props.productId)?.quantity ?? 0;
  const isCompact = variant === "compact";
  const maxQuantity =
    props.maxQuantity === null || props.maxQuantity === undefined
      ? null
      : Math.max(0, props.maxQuantity);
  const reachedLimit = !props.isPreorder && maxQuantity !== null && quantity >= maxQuantity;
  const isDisabled = Boolean(props.disabled);
  const radialControlsOpen = compactExpanded && isCompact && quantity > 0;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        globalThis.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!radialControlsOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!compactControlsRef.current?.contains(event.target as Node)) {
        setCompactExpanded(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [radialControlsOpen]);

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

    addItem({
      productId: props.productId,
      name: props.name,
      price: props.price,
      unit: props.unit,
      imageUrl: props.imageUrl,
      isPreorder: props.isPreorder,
    });
    triggerAddedState();
  }

  function handleCompactAdd() {
    handleAdd();

    if (!isDisabled && !reachedLimit) {
      setCompactExpanded(true);
    }
  }

  function handleCompactToggle() {
    if (isDisabled) {
      return;
    }

    setCompactExpanded((current) => !current);
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

  if (quantity > 0 && isCompact) {
    return (
      <div
        ref={compactControlsRef}
        className={cn(
          "relative h-16 shrink-0 overflow-visible transition-[width] duration-300 ease-out",
          radialControlsOpen ? "w-[7.25rem]" : "w-10",
        )}
        role="group"
        aria-label={`${props.name} в корзине`}
      >
        <button
          type="button"
          onClick={handleCompactToggle}
          className={cn(
            "absolute bottom-0 right-0 z-[2] inline-flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[var(--accent)] text-sm font-black text-white shadow-[0_14px_26px_rgba(47,143,79,0.24)] transition-all duration-300 active:scale-95",
            radialControlsOpen && "pointer-events-none scale-90 opacity-0",
            justAdded && "animate-[cart-pop_420ms_ease-out] shadow-[0_18px_34px_rgba(35,105,58,0.32)]",
          )}
          tabIndex={radialControlsOpen ? -1 : 0}
          aria-label={`Изменить количество товара ${props.name}`}
          aria-expanded={radialControlsOpen}
        >
          {quantity}
        </button>

        <div
          className={cn(
            "absolute bottom-0 right-0 z-[3] h-16 w-[7.25rem] transition duration-300 ease-out",
            radialControlsOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={!radialControlsOpen}
        >
          <button
            type="button"
            onClick={handleDecrease}
            tabIndex={radialControlsOpen ? 0 : -1}
            className={cn(
              "absolute bottom-0 left-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--accent-strong)] shadow-[0_12px_28px_rgba(53,84,63,0.18)] ring-1 ring-[rgba(47,143,79,0.14)] transition-all duration-300 ease-out active:scale-95",
              radialControlsOpen
                ? "translate-x-0 translate-y-0 scale-100"
                : "translate-x-[4.75rem] translate-y-0 scale-75",
            )}
            aria-label={`Уменьшить количество товара ${props.name}`}
          >
            <Minus size={15} />
          </button>

          <button
            type="button"
            onClick={() => setCompactExpanded(false)}
            tabIndex={radialControlsOpen ? 0 : -1}
            className={cn(
              "absolute left-[2.4rem] top-0 inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[var(--accent)] px-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(47,143,79,0.28)] transition-all duration-300 ease-out active:scale-95",
              radialControlsOpen
                ? "translate-x-0 translate-y-0 scale-100"
                : "translate-x-[2.35rem] translate-y-[1.5rem] scale-75",
              justAdded && "animate-[cart-pop_420ms_ease-out]",
            )}
            aria-live="polite"
            aria-label={`Свернуть выбор количества товара ${props.name}`}
          >
            {quantity}
          </button>

          <button
            type="button"
            onClick={handleIncrease}
            disabled={reachedLimit}
            tabIndex={radialControlsOpen ? 0 : -1}
            className={cn(
              "absolute bottom-0 right-0 inline-flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[var(--accent)] text-white shadow-[0_14px_26px_rgba(47,143,79,0.24)] transition-all duration-300 ease-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-45",
              radialControlsOpen
                ? "translate-x-0 translate-y-0 scale-100"
                : "translate-x-0 translate-y-0 scale-75",
            )}
            aria-label={`Увеличить количество товара ${props.name}`}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (quantity > 0) {
    return (
      <div
        className={cn(
          "relative flex min-h-11 items-center gap-2 overflow-hidden rounded-2xl bg-[var(--accent)] px-2 text-white shadow-[0_16px_30px_rgba(47,143,79,0.26)] transition-[transform,box-shadow] duration-300",
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
            isCompact && "h-7 w-7",
          )}
          aria-label={`Уменьшить количество товара ${props.name}`}
        >
          <Minus size={isCompact ? 13 : 15} />
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
            <span className={cn("text-base font-semibold tabular-nums", isCompact && "text-sm")}>
              {quantity}
            </span>
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
            isCompact && "h-7 w-7",
          )}
          aria-label={`Увеличить количество товара ${props.name}`}
        >
          <Plus size={isCompact ? 13 : 15} />
        </button>
      </div>
    );
  }

  if (isCompact) {
    return (
      <div ref={compactControlsRef} className="relative h-10 w-10 shrink-0">
        <button
          type="button"
          onClick={handleCompactAdd}
          disabled={isDisabled || reachedLimit}
          className="group inline-flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-1 ring-[var(--line-strong)] transition hover:-translate-y-0.5 hover:bg-[#d2eacc] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Добавить товар ${props.name} в корзину`}
        >
          <Plus size={16} className="transition-transform group-active:scale-90" />
        </button>
      </div>
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
