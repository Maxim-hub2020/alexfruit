import Link from "next/link";
import { MainShell } from "@/components/layout/main-shell";
import { CheckoutClient } from "@/components/storefront/checkout-client";
import { SharedCartCreatePanel } from "@/components/storefront/shared-cart-create-panel";
import { getCurrentUser } from "@/lib/auth";
import { getUserAddresses } from "@/lib/addresses";
import { getOwnedSharedCarts } from "@/lib/shared-carts";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();
  const addresses = user ? await getUserAddresses(user.id) : [];
  const sharedCarts = user ? await getOwnedSharedCarts(user.id) : [];

  return (
    <MainShell active="cart" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <h1 className="font-serif text-5xl font-semibold">Корзина</h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Проверьте товары и количество. Дату, адрес и комментарий выберете на
            следующем шаге оформления заказа.
          </p>
        </div>

        <CheckoutClient
          user={user ? { id: user.id, name: user.name } : null}
          addresses={addresses}
        />

        {user && sharedCarts.length > 0 ? (
          <section className="glass-panel rounded-[2rem] p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                  Общие корзины
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  Уже созданные
                </h2>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {sharedCarts.map((sharedCart) => {
                const subtotal = sharedCart.items.reduce(
                  (sum, item) => sum + Number(item.price) * Number(item.quantity),
                  0,
                );
                const order = sharedCart.orders[0];

                return (
                  <Link
                    key={sharedCart.id}
                    href={`/shared-cart/${sharedCart.token}`}
                    className="rounded-[1.5rem] bg-white/88 p-4 ring-1 ring-[var(--line)] transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{sharedCart.title}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {sharedCart.items.length} позиций · {formatCurrency(subtotal)}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                        {sharedCart.orderedAt ? "Оформлена" : "Наполняется"}
                      </span>
                    </div>
                    {order ? (
                      <p className="mt-3 text-sm text-[var(--accent-strong)]">
                        Заказ {order.orderNumber} уже создан
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--muted)]">
                        Откройте, чтобы скопировать ссылку или оформить общий заказ.
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <SharedCartCreatePanel user={user ? { id: user.id, name: user.name } : null} />
      </section>
    </MainShell>
  );
}
