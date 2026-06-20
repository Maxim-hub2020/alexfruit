import { format } from "date-fns";
import { Role } from "@/generated/prisma";
import { AdminDatePdfActions } from "@/components/admin/admin-date-pdf-actions";
import { AssemblyProductShortagePanel } from "@/components/admin/assembly-product-shortage-panel";
import { MainShell } from "@/components/layout/main-shell";
import { requirePageUser } from "@/lib/auth";
import { canPrintOrderLabelStatus } from "@/lib/constants";
import { getPickerAssemblyOrders } from "@/lib/orders";
import { toClientValue } from "@/lib/serialize";

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
  const orders = await getPickerAssemblyOrders({ date: selectedDate });
  const labelsUrl = `/api/admin/orders/labels?date=${encodeURIComponent(selectedDate)}`;
  const labelsCount = orders.filter((order) =>
    canPrintOrderLabelStatus(order.status),
  ).length;
  const assemblyUrl = `/api/admin/orders/assembly-pdf?date=${encodeURIComponent(selectedDate)}`;
  const procurementPdfUrl = `/api/admin/orders/procurement-pdf?date=${encodeURIComponent(selectedDate)}`;

  return (
    <MainShell active="admin-delivery" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <h1 className="font-serif text-5xl font-semibold">Сборка</h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Сводный список товаров на выбранную дату, контроль отсутствующих позиций
            и PDF-документы для сборщика и закупки.
          </p>
        </div>

        <AdminDatePdfActions
          basePath="/admin/delivery"
          selectedDate={selectedDate}
          ordersCount={orders.length}
          labelsCount={labelsCount}
          eyebrow="Дата сборки"
          title="Список сборки и PDF-документы"
          description="Список, этикетки и документы перестраиваются по выбранной дате, чтобы не смешивать сегодняшние и будущие заказы."
          labelsUrl={labelsUrl}
          assemblyUrl={assemblyUrl}
          procurementUrl={procurementPdfUrl}
          emptyText="Нет заказов для документов на выбранную дату."
          labelsEmptyText="Этикетки появятся после подтверждения заказа администратором."
        />

        <AssemblyProductShortagePanel orders={toClientValue(orders as never)} />
      </section>
    </MainShell>
  );
}
