import Link from "next/link";
import { format } from "date-fns";
import { FileText, MapPin } from "lucide-react";
import { Role } from "@/generated/prisma";
import { AdminCourierLocations } from "@/components/admin/admin-courier-locations";
import { AdminDatePdfActions } from "@/components/admin/admin-date-pdf-actions";
import { AdminRouteRebalancePanel } from "@/components/admin/admin-route-rebalance-panel";
import { YandexRoutePanel } from "@/components/admin/yandex-route-panel";
import { MainShell } from "@/components/layout/main-shell";
import { PhoneCallLink } from "@/components/ui/phone-call-link";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePageUser } from "@/lib/auth";
import { canPrintOrderLabelStatus } from "@/lib/constants";
import { getAdminCourierLocations } from "@/lib/courier-locations";
import { getDeliveryBoard, getUnassignedOrdersCount } from "@/lib/orders";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser([Role.ADMIN]);
  const params = await searchParams;
  const selectedDate =
    typeof params.date === "string" ? params.date : format(new Date(), "yyyy-MM-dd");
  const [orders, courierLocations, unassignedOrdersCount] = await Promise.all([
    getDeliveryBoard({
      date: selectedDate,
    }),
    getAdminCourierLocations(),
    getUnassignedOrdersCount(selectedDate),
  ]);
  const labelsUrl = `/api/admin/orders/labels?date=${encodeURIComponent(selectedDate)}`;
  const labelsCount = orders.filter((order) =>
    canPrintOrderLabelStatus(order.status),
  ).length;
  const assemblyUrl = `/api/admin/orders/assembly-pdf?date=${encodeURIComponent(selectedDate)}`;
  const deliveryPdfUrl = `/api/admin/orders/delivery-pdf?date=${encodeURIComponent(selectedDate)}`;
  const procurementPdfUrl = `/api/admin/orders/procurement-pdf?date=${encodeURIComponent(selectedDate)}`;

  return (
    <MainShell active="admin-delivery" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <h1 className="font-serif text-5xl font-semibold">Доставка и маршруты</h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Карта заказов, быстрый переход в Яндекс.Карты и первичный анализ нагрузки
            по курьерам, слотам и координатам адресов.
          </p>
        </div>

        <AdminDatePdfActions
          basePath="/admin/delivery"
          selectedDate={selectedDate}
          ordersCount={orders.length}
          labelsCount={labelsCount}
          eyebrow="Дата доставки"
          title="Фильтр заказов и PDF-документы"
          description="Список и документы перестраиваются автоматически по выбранной дате, чтобы не смешивать сегодняшние и будущие доставки."
          labelsUrl={labelsUrl}
          assemblyUrl={assemblyUrl}
          deliveryUrl={deliveryPdfUrl}
          procurementUrl={procurementPdfUrl}
          emptyText="Нет заказов для документов на выбранную дату."
          labelsEmptyText="Этикетки появятся после подтверждения заказа администратором."
        />

        <AdminRouteRebalancePanel
          date={selectedDate}
          unassignedCount={unassignedOrdersCount}
        />

        <YandexRoutePanel orders={orders} date={selectedDate} />
        <AdminCourierLocations couriers={courierLocations} />

        <div className="grid gap-4 xl:grid-cols-2">
          {orders.map((order) => (
            <article
              key={order.id}
              className={cn(
                "glass-panel rounded-[2rem] p-5",
                !order.courier && "ring-2 ring-amber-300",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">{order.orderNumber}</h2>
                    <StatusPill status={order.status} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Клиент: {order.user.name}
                  </p>
                  <PhoneCallLink phone={order.user.phone} className="mt-2" />
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {order.address.city}, {order.address.street}, {order.address.house}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    Слот {order.deliveryTimeSlot.title} · Курьер {order.courier?.name ?? "—"}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Link
                    href={`https://yandex.ru/maps/?text=${encodeURIComponent(
                      `${order.address.city} ${order.address.street} ${order.address.house}`,
                    )}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--line)]"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin size={16} />
                    Открыть адрес
                  </Link>
                  {canPrintOrderLabelStatus(order.status) ? (
                    <Link
                      href={`/api/admin/orders/${order.id}/label`}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText size={16} />
                      Этикетка CT221B 40×50
                    </Link>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]">
                      <FileText size={16} />
                      Ждёт подтверждения
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </MainShell>
  );
}
