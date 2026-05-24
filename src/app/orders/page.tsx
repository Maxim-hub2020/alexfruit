import { Role } from "@/generated/prisma";
import { MainShell } from "@/components/layout/main-shell";
import { RepeatOrderButton } from "@/components/orders/repeat-order-button";
import { RescheduleOrderDelivery } from "@/components/orders/reschedule-order-delivery";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency, formatDateInputValue } from "@/lib/utils";
import { getCustomerOrders } from "@/lib/orders";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requirePageUser([Role.CUSTOMER]);
  const orders = await getCustomerOrders(user.id);

  return (
    <MainShell active="orders" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <h1 className="font-serif text-5xl font-semibold">Ваши заказы</h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Здесь видны активные и завершённые доставки, а ещё можно повторить прошлый
            заказ в один клик.
          </p>
        </div>

        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="glass-panel rounded-[2rem] p-5">
              {order.notifications.length > 0 && (
                <div className="mb-4 rounded-[1.5rem] bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-100">
                  <p className="font-semibold">{order.notifications[0].title}</p>
                  <p className="mt-1">{order.notifications[0].message}</p>
                </div>
              )}
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold">{order.orderNumber}</h2>
                    <StatusPill status={order.status} />
                  </div>
                  <p className="text-sm text-[var(--muted)]">
                    Доставка {formatDateInputValue(order.deliveryDate)} · {order.deliveryTimeSlot.title}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {order.address.city}, {order.address.street}, {order.address.house}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {order.items.map((item) => (
                      <span
                        key={item.id}
                        className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium"
                      >
                        {item.productName} · {Number(item.orderedQuantity)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-white/85 p-4 ring-1 ring-[var(--line)]">
                  <p className="text-sm text-[var(--muted)]">Итоговая сумма</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatCurrency(order.finalTotal ?? order.preliminaryTotal)}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <RepeatOrderButton orderId={order.id} />
                  </div>
                  {["NEW", "PENDING_CONFIRMATION"].includes(order.status) ? (
                    <p className="mt-3 text-xs text-[var(--accent-strong)]">
                      Самостоятельное редактирование доступно до{" "}
                      {formatDateInputValue(order.editableUntil)}.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      Для изменений после блокировки используйте связь с администратором.
                    </p>
                  )}
                </div>
              </div>
              {order.notifications.length > 0 && (
                <RescheduleOrderDelivery
                  orderId={order.id}
                  addressId={order.address.id}
                  currentDate={formatDateInputValue(order.deliveryDate)}
                  currentSlotTitle={order.deliveryTimeSlot.title}
                />
              )}
            </article>
          ))}
        </div>
      </section>
    </MainShell>
  );
}
