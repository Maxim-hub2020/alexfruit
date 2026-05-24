import { MainShell } from "@/components/layout/main-shell";
import { CheckoutClient } from "@/components/storefront/checkout-client";
import { getCurrentUser } from "@/lib/auth";
import { getUserAddresses } from "@/lib/addresses";
import { getAvailableTimeSlots } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();
  const addresses = user ? await getUserAddresses(user.id) : [];
  const slots =
    user && addresses[0]
      ? await getAvailableTimeSlots(new Date().toISOString().slice(0, 10), {
          userId: user.id,
          addressId: addresses[0].id,
        })
      : [];

  return (
    <MainShell active="cart" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <h1 className="font-serif text-5xl font-semibold">Корзина и оформление</h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Клиент выбирает адрес, дату и временной интервал. Если слот заполнен,
            система сразу помечает его как недоступный.
          </p>
        </div>

        <CheckoutClient
          user={user ? { id: user.id, name: user.name } : null}
          addresses={addresses}
          initialSlots={slots}
        />
      </section>
    </MainShell>
  );
}
