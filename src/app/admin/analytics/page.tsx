import { Role } from "@/generated/prisma";
import { MainShell } from "@/components/layout/main-shell";
import { StatusPill } from "@/components/ui/status-pill";
import { getAdminAnalytics } from "@/lib/admin";
import { requirePageUser } from "@/lib/auth";
import { cn, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const [user, analytics] = await Promise.all([
    requirePageUser([Role.ADMIN]),
    getAdminAnalytics(),
  ]);
  const maxDailyOrders = Math.max(
    1,
    ...analytics.orders.dailyRows.map((row) => row.orders),
  );
  const maxSlotOrders = Math.max(
    1,
    ...analytics.orders.timeSlotRows.map((row) => row.count),
  );

  return (
    <MainShell active="admin-analytics" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Аналитика
          </p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">
            Заказы и курьеры
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Быстрый срез по выручке, статусам заказов, загрузке временных окон и работе
            курьеров. Это основа для будущих отчётов и планирования маршрутов.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Всего заказов" value={analytics.orders.total} />
          <MetricCard label="Активные" value={analytics.orders.active} />
          <MetricCard label="Доставлено" value={analytics.orders.delivered} />
          <MetricCard label="Выручка" value={formatCurrency(analytics.orders.revenue)} />
          <MetricCard label="Средний чек" value={formatCurrency(analytics.orders.averageCheck)} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="glass-panel rounded-[2rem] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
                  Заказы
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Статусы и выручка</h2>
              </div>
              <span className="rounded-full bg-white/80 px-3 py-2 text-sm font-semibold text-[var(--accent-strong)]">
                {analytics.orders.issues} проблем
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {analytics.orders.statusRows
                .filter((row) => row.count > 0)
                .map((row) => (
                  <div key={row.status} className="rounded-[1.35rem] bg-white/82 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <StatusPill status={row.status} />
                      <div className="text-right">
                        <p className="font-semibold">{row.count} заказов</p>
                        <p className="text-sm text-[var(--muted)]">
                          {formatCurrency(row.revenue)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${Math.max(6, row.share)}%` }}
                      />
                    </div>
                  </div>
                ))}

              {analytics.orders.statusRows.every((row) => row.count === 0) && (
                <div className="rounded-[1.35rem] bg-white/80 p-8 text-center text-[var(--muted)]">
                  Заказов пока нет, аналитика появится после первых оформлений.
                </div>
              )}
            </div>
          </section>

          <section className="glass-panel rounded-[2rem] p-5">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              Последние 7 дней
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Динамика заказов</h2>

            <div className="mt-6 flex h-56 items-end gap-3 rounded-[1.6rem] bg-white/80 p-4">
              {analytics.orders.dailyRows.map((row) => (
                <div key={row.date} className="flex h-full flex-1 flex-col justify-end gap-2">
                  <div
                    className="min-h-2 rounded-t-2xl bg-[var(--accent)]"
                    style={{
                      height: `${Math.max(4, (row.orders / maxDailyOrders) * 100)}%`,
                    }}
                    title={`${row.orders} заказов · ${formatCurrency(row.revenue)}`}
                  />
                  <p className="truncate text-center text-[10px] text-[var(--muted)]">
                    {row.date.slice(5)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              <h3 className="font-semibold">Загрузка временных окон</h3>
              {analytics.orders.timeSlotRows.map((slot) => (
                <div key={slot.id} className="rounded-[1.25rem] bg-white/82 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">{slot.title}</span>
                    <span className="text-[var(--muted)]">
                      {slot.count} заказов · {slot.delivered} доставлено
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[var(--surface-muted)]">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        slot.issues > 0 ? "bg-orange-400" : "bg-[var(--accent)]",
                      )}
                      style={{ width: `${Math.max(5, (slot.count / maxSlotOrders) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="glass-panel rounded-[2rem] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
                Курьеры
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Эффективность доставки</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {analytics.couriers.active} активных · {analytics.couriers.archived} в архиве
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <MetricMini label="Назначено" value={analytics.couriers.assignedOrders} />
              <MetricMini label="Доставлено" value={analytics.couriers.deliveredOrders} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {analytics.couriers.rows.map((courier) => (
              <article key={courier.id} className="rounded-[1.6rem] bg-white/86 p-4 ring-1 ring-[var(--line)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{courier.name}</h3>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          courier.isActive
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-slate-100 text-slate-700",
                        )}
                      >
                        {courier.isActive ? "Активен" : "Архив"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {courier.phone ?? courier.email ?? "контакты не указаны"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-[var(--accent-strong)]">
                      {courier.completionRate}%
                    </p>
                    <p className="text-xs text-[var(--muted)]">доставляемость</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <MetricMini label="Всего" value={courier.assignedOrders} />
                  <MetricMini label="Активные" value={courier.activeOrders} />
                  <MetricMini label="Проблемы" value={courier.issueOrders + courier.problemTasks} />
                  <MetricMini label="Выручка" value={formatCurrency(courier.deliveredRevenue)} />
                </div>
              </article>
            ))}

            {analytics.couriers.rows.length === 0 && (
              <div className="rounded-[1.6rem] bg-white/80 p-8 text-center text-[var(--muted)]">
                Курьеры пока не добавлены.
              </div>
            )}
          </div>
        </section>
      </section>
    </MainShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="glass-panel rounded-[1.75rem] p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </article>
  );
}

function MetricMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.1rem] bg-[var(--surface-muted)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
