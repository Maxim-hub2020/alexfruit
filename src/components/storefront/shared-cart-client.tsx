"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  LogOut,
  Minus,
  Plus,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import { SharedCartCheckoutPanel } from "@/components/storefront/shared-cart-checkout-panel";
import { CatalogImage } from "@/components/ui/catalog-image";
import { unitLabels } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

type SharedCartItem = {
  id: string;
  productId: string;
  productName: string;
  price: number | string;
  unit: string;
  quantity: number | string;
  addedById: string;
  addedBy: {
    id: string;
    name: string;
    phone?: string | null;
  };
  product: {
    id: string;
    imageUrl?: string | null;
    isActive: boolean;
  };
};

type SharedCart = {
  id: string;
  token: string;
  title: string;
  ownerId: string;
  orderedAt?: string | null;
  owner: {
    id: string;
    name: string;
    phone?: string | null;
  };
  items: SharedCartItem[];
};

type SharedCartProduct = {
  id: string;
  name: string;
  price: number | string;
  unit: string;
  imageUrl?: string | null;
  category: {
    name: string;
    slug: string;
  };
};

type SharedCartUser = {
  id: string;
  name: string;
  role: string;
} | null;

type SharedCartAddress = {
  id: string;
  title: string;
  city: string;
  street: string;
  house: string;
};

type SharedCartTimeSlot = {
  id: string;
  title: string;
  available?: boolean;
  reason?: string | null;
};

function getShareUrl(token: string) {
  if (typeof window === "undefined") {
    return `/shared-cart/${token}`;
  }

  return new URL(`/shared-cart/${token}`, window.location.origin).toString();
}

export function SharedCartClient({
  sharedCart,
  products,
  user,
  addresses,
  initialSlots,
}: {
  sharedCart: SharedCart;
  products: SharedCartProduct[];
  user: SharedCartUser;
  addresses: SharedCartAddress[];
  initialSlots: SharedCartTimeSlot[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [isPending, startTransition] = useTransition();
  const shareUrl = getShareUrl(sharedCart.token);
  const isOrdered = Boolean(sharedCart.orderedAt);
  const isOwner = Boolean(user && user.id === sharedCart.ownerId);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return products.slice(0, 12);
    }

    return products
      .filter((product) => {
        return (
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.category.name.toLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, 18);
  }, [deferredQuery, products]);

  const total = sharedCart.items.reduce((sum, item) => {
    return sum + Number(item.price) * Number(item.quantity);
  }, 0);

  const totalQuantity = sharedCart.items.reduce((sum, item) => {
    return sum + Number(item.quantity);
  }, 0);

  function canManageItem(item: SharedCartItem) {
    if (!user || isOrdered) {
      return false;
    }

    return (
      user.role === "ADMIN" ||
      user.id === sharedCart.ownerId ||
      user.id === item.addedById
    );
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Ссылка скопирована.");
    } catch {
      setMessage("Скопируйте ссылку из адресной строки браузера.");
    }
  }

  async function addProduct(productId: string) {
    if (isOrdered) {
      setError("Общая корзина уже оформлена и закрыта для изменений.");
      return;
    }

    if (!user) {
      setError("Войдите в профиль, чтобы добавить товар в общую корзину.");
      return;
    }

    setError("");
    setMessage("");
    setBusyId(`add-${productId}`);

    const response = await fetch(`/api/shared-carts/${sharedCart.token}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    const result = await response.json();
    setBusyId("");

    if (!response.ok) {
      setError(result.error ?? "Не удалось добавить товар.");
      return;
    }

    setMessage("Товар добавлен в общую корзину.");
    startTransition(() => {
      router.refresh();
    });
  }

  async function updateItemQuantity(item: SharedCartItem, quantity: number) {
    if (!canManageItem(item)) {
      return;
    }

    setError("");
    setBusyId(item.id);
    const response = await fetch(
      `/api/shared-carts/${sharedCart.token}/items/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      },
    );
    const result = await response.json();
    setBusyId("");

    if (!response.ok) {
      setError(result.error ?? "Не удалось изменить количество.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  async function removeItem(item: SharedCartItem) {
    if (!canManageItem(item)) {
      return;
    }

    setError("");
    setBusyId(item.id);
    const response = await fetch(
      `/api/shared-carts/${sharedCart.token}/items/${item.id}`,
      { method: "DELETE" },
    );
    const result = await response.json();
    setBusyId("");

    if (!response.ok) {
      setError(result.error ?? "Не удалось удалить позицию.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  async function leaveCurrentSharedCart() {
    if (!user || isOwner) {
      return;
    }

    setError("");
    setMessage("");
    setBusyId("leave-cart");

    const response = await fetch(`/api/shared-carts/${sharedCart.token}/leave`, {
      method: "POST",
    });
    const result = await response.json().catch(() => null);
    setBusyId("");

    if (!response.ok) {
      setError(result?.error ?? "Не удалось выйти из общей корзины.");
      return;
    }

    router.push("/cart");
    router.refresh();
  }

  async function deleteCurrentSharedCart() {
    if (!user || !isOwner) {
      return;
    }

    const confirmed = window.confirm(
      "Удалить общую корзину? Ссылка перестанет открываться, а участники больше не смогут добавлять товары.",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");
    setBusyId("delete-cart");

    const response = await fetch(`/api/shared-carts/${sharedCart.token}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => null);
    setBusyId("");

    if (!response.ok) {
      setError(result?.error ?? "Не удалось удалить общую корзину.");
      return;
    }

    router.push("/cart");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel overflow-hidden rounded-[2.4rem]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <UsersRound size={22} />
              </span>
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                  Общая корзина
                </p>
                <h1 className="font-serif text-4xl font-semibold md:text-5xl">
                  {sharedCart.title}
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Организатор: {sharedCart.owner.name}. Участники добавляют свои товары
              отдельно, а личная корзина каждого покупателя остаётся отдельно от общей.
            </p>
            {isOrdered ? (
              <p className="mt-4 inline-flex rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">
                Общая корзина уже оформлена в заказ
              </p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-[2rem] bg-white/78 p-4 ring-1 ring-[var(--line)]">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
                <p className="text-[var(--muted)]">Позиций</p>
                <p className="mt-1 text-2xl font-bold">{sharedCart.items.length}</p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
                <p className="text-[var(--muted)]">Количество</p>
                <p className="mt-1 text-2xl font-bold">{totalQuantity}</p>
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--accent-soft)] p-4">
              <p className="text-sm text-[var(--accent-strong)]">Предварительно</p>
              <p className="mt-1 text-3xl font-bold text-[var(--accent-strong)]">
                {formatCurrency(total)}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={copyShareUrl}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--line)] transition active:scale-95"
              >
                <Copy size={15} />
                Ссылка
              </button>
              {isOwner ? (
                <button
                  type="button"
                  onClick={deleteCurrentSharedCart}
                  disabled={busyId === "delete-cart" || isPending}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-rose-50 text-sm font-semibold text-rose-700 ring-1 ring-rose-100 transition active:scale-95 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  {busyId === "delete-cart" ? "Удаляем..." : "Удалить"}
                </button>
              ) : user ? (
                <button
                  type="button"
                  onClick={leaveCurrentSharedCart}
                  disabled={busyId === "leave-cart" || isPending || isOrdered}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] transition active:scale-95 disabled:opacity-50"
                >
                  <LogOut size={15} />
                  {busyId === "leave-cart" ? "Выходим..." : "Выйти"}
                </button>
              ) : null}
            </div>
            <SharedCartCheckoutPanel
              token={sharedCart.token}
              subtotal={total}
              itemsCount={sharedCart.items.length}
              isOwner={isOwner}
              isOrdered={isOrdered}
              addresses={addresses}
              initialSlots={initialSlots}
            />
            {!user && (
              <Link
                href="/login"
                className="block rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
              >
                Войдите, чтобы добавить свои товары
              </Link>
            )}
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="glass-panel rounded-[2rem] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                Общий список
              </p>
              <h2 className="text-2xl font-semibold">Что уже добавили</h2>
            </div>
          </div>

          {sharedCart.items.length === 0 ? (
            <div className="rounded-[1.5rem] bg-white/80 p-8 text-center text-[var(--muted)]">
              Пока пусто. Добавьте первую позицию из каталога справа.
            </div>
          ) : (
            <div className="space-y-3">
              {sharedCart.items.map((item) => {
                const canManage = canManageItem(item);
                const quantity = Number(item.quantity);

                return (
                  <article
                    key={item.id}
                    className="flex flex-col gap-4 rounded-[1.6rem] bg-white/90 p-4 ring-1 ring-[var(--line)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[var(--surface-muted)]">
                        {item.product.imageUrl ? (
                          <CatalogImage
                            src={item.product.imageUrl}
                            alt={item.productName}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-3xl">
                            🍎
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.productName}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {formatCurrency(item.price)} за{" "}
                          {unitLabels[item.unit] ?? item.unit} · добавил{" "}
                          {item.addedBy.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <p className="font-semibold">
                        {formatCurrency(Number(item.price) * quantity)}
                      </p>
                      {canManage ? (
                        <div className="flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-2 py-1">
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(item, quantity - 1)}
                            disabled={busyId === item.id || isPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white transition active:scale-95 disabled:opacity-50"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="min-w-7 text-center font-semibold tabular-nums">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(item, quantity + 1)}
                            disabled={busyId === item.id || isPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white transition active:scale-95 disabled:opacity-50"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item)}
                            disabled={busyId === item.id || isPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-700 transition active:scale-95 disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="rounded-full bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold">
                          {quantity}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="glass-panel h-fit rounded-[2rem] p-5">
          <div className="mb-4 space-y-3">
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Добавить товар
            </p>
            <h2 className="text-2xl font-semibold">Каталог для участников</h2>
            <label className="relative block">
              <Search
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти товар"
                className="h-12 w-full rounded-2xl bg-white pl-11 pr-4 text-sm outline-none ring-1 ring-[var(--line)]"
              />
            </label>
          </div>

          <div className="grid gap-3">
            {filteredProducts.map((product) => {
              const isBusy = busyId === `add-${product.id}`;

              return (
                <article
                  key={product.id}
                  className="flex items-center gap-3 rounded-[1.4rem] bg-white/88 p-3 ring-1 ring-[var(--line)]"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[var(--surface-muted)]">
                    {product.imageUrl ? (
                      <CatalogImage
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">
                        🍏
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{product.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {formatCurrency(product.price)} за{" "}
                      {unitLabels[product.unit] ?? product.unit}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addProduct(product.id)}
                    disabled={!user || isBusy || isOrdered}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white transition active:scale-95 disabled:bg-white disabled:text-[var(--muted)] disabled:ring-1 disabled:ring-[var(--line)]"
                    aria-label={`Добавить ${product.name} в общую корзину`}
                  >
                    <Plus size={19} />
                  </button>
                </article>
              );
            })}
          </div>
        </aside>
      </section>
    </div>
  );
}
