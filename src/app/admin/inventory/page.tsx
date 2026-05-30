import { Role } from "@/generated/prisma";
import { AdminInventoryManager } from "@/components/admin/admin-inventory-manager";
import { MainShell } from "@/components/layout/main-shell";
import { requirePageUser } from "@/lib/auth";
import { getDefaultDeliveryDate } from "@/lib/delivery-rules";
import { getDailyInventoryBoard, normalizeInventoryDate } from "@/lib/inventory";
import { toClientValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, params] = await Promise.all([requirePageUser([Role.ADMIN]), searchParams]);
  const defaultDeliveryDate = getDefaultDeliveryDate();
  const dateParam = Array.isArray(params.date) ? params.date[0] : params.date;
  const date = normalizeInventoryDate(dateParam ?? defaultDeliveryDate);
  const board = await getDailyInventoryBoard(date);

  return (
    <MainShell active="admin-inventory" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Ежедневное наличие
          </p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">Склад на день</h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Быстро задавайте остатки на выбранную дату. Клиенты увидят только
            доступные позиции, а новые заказы автоматически зарезервируют товар.
          </p>
        </div>

        <AdminInventoryManager
          key={board.date}
          date={board.date}
          defaultDeliveryDate={defaultDeliveryDate}
          products={toClientValue(board.products as never)}
        />
      </section>
    </MainShell>
  );
}
