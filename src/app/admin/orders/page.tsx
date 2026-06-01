import Link from "next/link";
import { Role } from "@/generated/prisma";
import { AdminDatePdfActions } from "@/components/admin/admin-date-pdf-actions";
import { AdminOrderManager } from "@/components/admin/admin-order-manager";
import { AssemblyProductShortagePanel } from "@/components/admin/assembly-product-shortage-panel";
import { MainShell } from "@/components/layout/main-shell";
import { requirePageUser } from "@/lib/auth";
import { canPrintOrderLabelStatus } from "@/lib/constants";
import { getAdminOrders, getUnassignedOrdersCount } from "@/lib/orders";
import { toClientValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser([Role.ADMIN]);
  const params = await searchParams;
  const selectedDate = typeof params.date === "string" ? params.date : "";
  const courierFilter = typeof params.courierId === "string" ? params.courierId : null;
  const [orders, unassignedOrdersCount] = await Promise.all([
    getAdminOrders({
      date: selectedDate || null,
      status: typeof params.status === "string" ? params.status : null,
      customer: typeof params.customer === "string" ? params.customer : null,
      courierId: courierFilter,
      timeSlotId: typeof params.timeSlotId === "string" ? params.timeSlotId : null,
    }),
    getUnassignedOrdersCount(selectedDate || null),
  ]);
  const baseQuery = new URLSearchParams();
  const unassignedQuery = new URLSearchParams();

  if (selectedDate) {
    baseQuery.set("date", selectedDate);
    unassignedQuery.set("date", selectedDate);
  }

  unassignedQuery.set("courierId", "unassigned");

  const allOrdersQuery = baseQuery.toString();
  const allOrdersUrl = allOrdersQuery ? `/admin/orders?${allOrdersQuery}` : "/admin/orders";
  const unassignedUrl = `/admin/orders?${unassignedQuery}`;
  const labelsUrl = selectedDate
    ? `/api/admin/orders/labels?date=${encodeURIComponent(selectedDate)}`
    : "";
  const labelsCount = orders.filter((order) =>
    canPrintOrderLabelStatus(order.status),
  ).length;
  const assemblyUrl = selectedDate
    ? `/api/admin/orders/assembly-pdf?date=${encodeURIComponent(selectedDate)}`
    : "";
  const deliveryPdfUrl = selectedDate
    ? `/api/admin/orders/delivery-pdf?date=${encodeURIComponent(selectedDate)}`
    : "";

  return (
    <MainShell active="admin-orders" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <h1 className="font-serif text-5xl font-semibold">Заказы и сборка</h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Подтверждайте новые заказы, назначайте курьеров и переводите доставку по
            статусам без отдельной CRM.
          </p>
        </div>

        <AdminDatePdfActions
          basePath="/admin/orders"
          selectedDate={selectedDate}
          ordersCount={orders.length}
          labelsCount={labelsCount}
          eyebrow="Фильтр по дате"
          title="Заказы на выбранную дату"
          description="Выберите дату доставки: список заказов, этикетки, лист сборки и маршрутный лист будут собраны только по ней."
          labelsUrl={labelsUrl}
          assemblyUrl={assemblyUrl}
          deliveryUrl={deliveryPdfUrl}
          emptyText="Нет заказов для документов на выбранную дату."
          labelsEmptyText="Этикетки появятся после подтверждения заказа администратором."
        />

        <div className="glass-panel flex flex-col gap-4 rounded-[2rem] p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Назначение курьеров
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              {courierFilter === "unassigned"
                ? "Показаны заказы без курьера"
                : "Заказы без курьера"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {unassignedOrdersCount} заказ(ов) требуют ручного назначения.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={unassignedUrl}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white"
            >
              Показать без курьера
            </Link>
            {courierFilter === "unassigned" ? (
              <Link
                href={allOrdersUrl}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)]"
              >
                Все заказы
              </Link>
            ) : null}
          </div>
        </div>

        {unassignedOrdersCount > 0 ? (
          <div className="rounded-[1.7rem] bg-amber-50 p-5 text-amber-950 ring-1 ring-amber-100">
            <p className="text-lg font-semibold">
              Внимание! Есть {unassignedOrdersCount} заказ(ов) без назначенного курьера.
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Автораспределение назначает курьера при создании заказа, поэтому такие
              заказы появились после ручного снятия назначения или отсутствия активных
              курьеров.
            </p>
          </div>
        ) : null}

        <AssemblyProductShortagePanel orders={toClientValue(orders as never)} />

        <AdminOrderManager orders={toClientValue(orders as never)} />
      </section>
    </MainShell>
  );
}
