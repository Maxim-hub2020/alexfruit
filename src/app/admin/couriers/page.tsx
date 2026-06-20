import { format } from "date-fns";
import { Role } from "@/generated/prisma";
import { AdminCourierLocations } from "@/components/admin/admin-courier-locations";
import { AdminCourierHistorySearch } from "@/components/admin/admin-courier-history-search";
import { AdminCourierManager } from "@/components/admin/admin-courier-manager";
import { AdminDatePdfActions } from "@/components/admin/admin-date-pdf-actions";
import { AdminPickerManager } from "@/components/admin/admin-picker-manager";
import { AdminRouteRebalancePanel } from "@/components/admin/admin-route-rebalance-panel";
import { YandexRoutePanel } from "@/components/admin/yandex-route-panel";
import { MainShell } from "@/components/layout/main-shell";
import { getAdminCourierBoard, getAdminPickers, searchCourierDeliveryHistory } from "@/lib/admin";
import { requirePageUser } from "@/lib/auth";
import { getAdminCourierLocations } from "@/lib/courier-locations";
import { getDeliveryBoard, getUnassignedOrdersCount } from "@/lib/orders";
import { toClientValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function AdminCouriersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser([Role.ADMIN]);
  const params = await searchParams;
  const selectedDate =
    typeof params.date === "string" ? params.date : format(new Date(), "yyyy-MM-dd");
  const filters = {
    address: typeof params.address === "string" ? params.address : "",
    date: selectedDate,
    courierId: typeof params.courierId === "string" ? params.courierId : "",
  };
  const [couriers, pickers, courierHistory, deliveryOrders, courierLocations, unassignedOrdersCount] = await Promise.all([
    getAdminCourierBoard(),
    getAdminPickers(),
    searchCourierDeliveryHistory(filters),
    getDeliveryBoard({ date: selectedDate }),
    getAdminCourierLocations(),
    getUnassignedOrdersCount(selectedDate),
  ]);
  const deliveryPdfUrl = `/api/admin/orders/delivery-pdf?date=${encodeURIComponent(selectedDate)}`;

  return (
    <MainShell active="admin-couriers" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Курьеры
          </p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">
            Управление командой доставки
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Добавляйте курьеров, выдавайте им доступ в кабинет и удаляйте из активной системы,
            когда человек больше не работает с доставками. Здесь же собраны маршруты,
            карта заказов и анализ нагрузки.
          </p>
        </div>

        <AdminDatePdfActions
          basePath="/admin/couriers"
          selectedDate={selectedDate}
          ordersCount={deliveryOrders.length}
          eyebrow="Дата маршрутов"
          title="Маршруты и документы доставки"
          description="Выберите дату доставки: маршруты, карта и PDF для доставщика перестроятся под выбранный день."
          deliveryUrl={deliveryPdfUrl}
          emptyText="Нет заказов для маршрутов на выбранную дату."
        />

        <AdminRouteRebalancePanel
          date={selectedDate}
          unassignedCount={unassignedOrdersCount}
        />

        <YandexRoutePanel orders={deliveryOrders} date={selectedDate} />
        <AdminCourierLocations couriers={courierLocations} />

        <AdminCourierManager couriers={toClientValue(couriers)} />
        <AdminPickerManager pickers={toClientValue(pickers)} />
        <AdminCourierHistorySearch
          couriers={toClientValue(couriers)}
          history={courierHistory}
          filters={filters}
        />
      </section>
    </MainShell>
  );
}
