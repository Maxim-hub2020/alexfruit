import { Role } from "@/generated/prisma";
import { AdminDatePdfActions } from "@/components/admin/admin-date-pdf-actions";
import { AdminOrderManager } from "@/components/admin/admin-order-manager";
import { AssemblyProductShortagePanel } from "@/components/admin/assembly-product-shortage-panel";
import { MainShell } from "@/components/layout/main-shell";
import { requirePageUser } from "@/lib/auth";
import { canPrintOrderLabelStatus } from "@/lib/constants";
import { getAdminOrders } from "@/lib/orders";
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
  const orders = await getAdminOrders({
    date: selectedDate || null,
    status: typeof params.status === "string" ? params.status : null,
    customer: typeof params.customer === "string" ? params.customer : null,
    courierId: typeof params.courierId === "string" ? params.courierId : null,
    timeSlotId: typeof params.timeSlotId === "string" ? params.timeSlotId : null,
  });
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

        <AssemblyProductShortagePanel orders={toClientValue(orders as never)} />

        <AdminOrderManager orders={toClientValue(orders as never)} />
      </section>
    </MainShell>
  );
}
