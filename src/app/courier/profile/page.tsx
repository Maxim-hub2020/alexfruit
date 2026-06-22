import Link from "next/link";
import { CalendarDays, CheckCircle2, ClipboardList, Phone, ShieldCheck } from "lucide-react";
import { Role } from "@/generated/prisma";
import { MainShell } from "@/components/layout/main-shell";
import { LogoutButton } from "@/components/profile/logout-button";
import { requirePageUser } from "@/lib/auth";
import { roleLabels } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CourierProfilePage() {
  const user = await requirePageUser([Role.COURIER]);
  const courier = user.courierProfile;
  const courierPhone = courier?.phone || user.phone;

  return (
    <MainShell active="courier-profile" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Профиль курьера
          </p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">{user.name}</h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Рабочий кабинет для доставок АлексФрут: быстрый доступ к заказам,
            маршруту и статусу профиля.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="glass-panel rounded-[2rem] p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <ShieldCheck size={22} />
            </div>
            <p className="mt-4 text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Роль
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{roleLabels[user.role]}</h2>
          </div>

          <div className="glass-panel rounded-[2rem] p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <Phone size={22} />
            </div>
            <p className="mt-4 text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Телефон
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              {courierPhone || "Не указан"}
            </h2>
          </div>

          <div className="glass-panel rounded-[2rem] p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <CheckCircle2 size={22} />
            </div>
            <p className="mt-4 text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Статус
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              {courier?.isActive === false ? "Неактивен" : "Активен"}
            </h2>
          </div>
        </div>

        <div className="glass-panel rounded-[2.2rem] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
                Быстрый переход
              </p>
              <h2 className="mt-2 text-3xl font-semibold">Заказы курьера</h2>
              <p className="mt-2 text-[var(--muted)]">
                Откройте просроченные, сегодняшние или завтрашние доставки.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/courier?tab=today&day=yesterday"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)]"
              >
                <CalendarDays size={17} />
                Заказы вчера
              </Link>
              <Link
                href="/courier?tab=today&day=today"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(47,143,79,0.22)]"
              >
                <ClipboardList size={17} />
                Заказы сегодня
              </Link>
              <Link
                href="/courier?tab=today&day=tomorrow"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)]"
              >
                <CalendarDays size={17} />
                Заказы завтра
              </Link>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[2.2rem] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Смена пользователя</h2>
              <p className="mt-2 text-[var(--muted)]">
                Завершите смену, если передаёте устройство другому сотруднику.
              </p>
            </div>
            <LogoutButton label="Выйти" className="w-full sm:w-auto" />
          </div>
        </div>
      </section>
    </MainShell>
  );
}
