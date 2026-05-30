import { Role } from "@/generated/prisma";
import { MainShell } from "@/components/layout/main-shell";
import { CustomerOrderActions } from "@/components/orders/customer-order-actions";
import { RepeatOrderButton } from "@/components/orders/repeat-order-button";
import { RescheduleOrderDelivery } from "@/components/orders/reschedule-order-delivery";
import { StatusPill } from "@/components/ui/status-pill";
import { getUserAddresses } from "@/lib/addresses";
import { formatCurrency, formatDateInputValue, formatDateTimeLabel } from "@/lib/utils";
import { canCustomerEdit, getCustomerOrders } from "@/lib/orders";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const unavailableProductTitlePrefixes = [
  "Сейчас нет: ",
  "Нужно выбрать новую дату: ",
];

function getUnavailableProductName(notification: {
  title: string;
  message: string;
}) {
  for (const prefix of unavailableProductTitlePrefixes) {
    if (notification.title.startsWith(prefix)) {
      return notification.title.slice(prefix.length).trim();
    }
  }

  return notification.message.match(/«(.+?)»/)?.[1]?.trim() ?? "позиция заказа";
}

export default async function OrdersPage() {
  const user = await requirePageUser([Role.CUSTOMER]);
  const [orders, addresses] = await Promise.all([
    getCustomerOrders(user.id),
    getUserAddresses(user.id),
  ]);

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
              {order.notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="mb-4 rounded-[1.5rem] bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-100"
                >
                  <p className="font-semibold">
                    Сейчас нет: {getUnavailableProductName(notification)}
                  </p>
                  <p className="mt-1">{notification.message}</p>
                </div>
              ))}
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold">{order.orderNumber}</h2>
                    <StatusPill status={order.status} />
                    {order.sharedCartId ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                        Общий заказ
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-[var(--muted)]">
                    Доставка {formatDateInputValue(order.deliveryDate)} · в течение дня
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {order.address.city}, {order.address.street}, {order.address.house}
                  </p>
                  {order.needsLift ? (
                    <p className="text-sm font-semibold text-[var(--accent-strong)]">
                      Нужен подъём до двери
                    </p>
                  ) : null}
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
                  {canCustomerEdit(order) ? (
                    <p className="mt-3 text-xs text-[var(--accent-strong)]">
                      Можно менять или отменить до{" "}
                      {formatDateTimeLabel(order.editableUntil)}, пока заказ не собран.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      Изменения доступны 3 часа после оформления, пока заказ не собран.
                    </p>
                  )}
                </div>
              </div>
              <CustomerOrderActions
                canManage={canCustomerEdit(order)}
                addresses={addresses}
                order={{
                  id: order.id,
                  status: order.status,
                  editableUntil: order.editableUntil.toISOString(),
                  addressId: order.addressId,
                  deliveryDate: formatDateInputValue(order.deliveryDate),
                  deliveryTimeSlotId: order.deliveryTimeSlotId,
                  needsLift: order.needsLift,
                  customerComment: order.customerComment ?? "",
                  items: order.items.map((item) => ({
                    id: item.id,
                    productId: item.productId,
                    productName: item.productName,
                    unit: item.unit,
                    quantity: Number(item.orderedQuantity),
                  })),
                }}
              />
              {order.notifications.map((notification) => (
                <RescheduleOrderDelivery
                  key={notification.id}
                  orderId={order.id}
                  notificationId={notification.id}
                  unavailableProductName={getUnavailableProductName(notification)}
                  currentDate={formatDateInputValue(order.deliveryDate)}
                  currentSlotTitle={order.deliveryTimeSlot.title}
                />
              ))}
            </article>
          ))}
        </div>
      </section>
    </MainShell>
  );
}
