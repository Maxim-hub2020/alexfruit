import Link from "next/link";
import { Role } from "@/generated/prisma";
import { MainShell } from "@/components/layout/main-shell";
import { requirePageUser } from "@/lib/auth";
import { getAdminDashboard } from "@/lib/orders";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const adminSections = [
  {
    href: "/admin/orders",
    title: "Управление заказами",
    description: "Подтверждение, сборка, курьеры, статусы и итоговые суммы.",
  },
  {
    href: "/admin/products",
    title: "Каталог и цены",
    description: "Товары, категории, наличие, фото, акции и цены для витрины.",
  },
  {
    href: "/admin/couriers",
    title: "Курьеры",
    description: "Добавление курьеров, доступы в кабинет и удаление из активной системы.",
  },
  {
    href: "/admin/delivery",
    title: "Маршруты и доставка",
    description: "Адреса, распределение заказов и быстрый переход в Яндекс.Карты.",
  },
  {
    href: "/admin/analytics",
    title: "Аналитика",
    description: "Срез по заказам, статусам, временным окнам и эффективности курьеров.",
  },
] as const;

export default async function AdminPage() {
  const user = await requirePageUser([Role.ADMIN]);
  const dashboard = await getAdminDashboard();

  return (
    <MainShell active="admin" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.4rem] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Админ-панель
          </p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">
            Операционный центр доставки
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Контроль заказов, сборки, курьеров, каталога и аналитики в одном интерфейсе.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          {[
            ["Заказов сегодня", dashboard.ordersToday],
            ["Новые", dashboard.newOrders],
            ["В сборке", dashboard.assembling],
            ["В доставке", dashboard.inDelivery],
            ["Выполнено", dashboard.delivered],
            ["Проблемы", dashboard.issues],
            ["Выручка", formatCurrency(dashboard.revenue)],
          ].map(([label, value]) => (
            <article key={label} className="glass-panel rounded-[1.75rem] p-4">
              <p className="text-sm text-[var(--muted)]">{label}</p>
              <p className="mt-3 text-3xl font-semibold">{value}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {adminSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="glass-panel rounded-[2rem] p-5 transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(61,93,74,0.14)]"
            >
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {section.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </MainShell>
  );
}
