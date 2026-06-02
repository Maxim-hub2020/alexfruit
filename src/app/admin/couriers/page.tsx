import { Role } from "@/generated/prisma";
import { AdminCourierHistorySearch } from "@/components/admin/admin-courier-history-search";
import { AdminCourierManager } from "@/components/admin/admin-courier-manager";
import { AdminPickerManager } from "@/components/admin/admin-picker-manager";
import { MainShell } from "@/components/layout/main-shell";
import { getAdminCourierBoard, getAdminPickers, searchCourierDeliveryHistory } from "@/lib/admin";
import { requirePageUser } from "@/lib/auth";
import { toClientValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function AdminCouriersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser([Role.ADMIN]);
  const params = await searchParams;
  const filters = {
    address: typeof params.address === "string" ? params.address : "",
    date: typeof params.date === "string" ? params.date : "",
    courierId: typeof params.courierId === "string" ? params.courierId : "",
  };
  const [couriers, pickers, courierHistory] = await Promise.all([
    getAdminCourierBoard(),
    getAdminPickers(),
    searchCourierDeliveryHistory(filters),
  ]);

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
            когда человек больше не работает с доставками.
          </p>
        </div>

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
