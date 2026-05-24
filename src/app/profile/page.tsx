import { Role } from "@/generated/prisma";
import { MainShell } from "@/components/layout/main-shell";
import { AddressBook } from "@/components/orders/address-book";
import { LogoutButton } from "@/components/profile/logout-button";
import { ProfileDetailsForm } from "@/components/profile/profile-details-form";
import { notificationTypeLabels } from "@/lib/constants";
import { getUserAddresses } from "@/lib/addresses";
import { requirePageUser } from "@/lib/auth";
import { formatDateTimeLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requirePageUser([Role.CUSTOMER]);
  const addresses = await getUserAddresses(user.id);

  return (
    <MainShell active="profile" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="glass-panel rounded-[2.2rem] p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              Профиль клиента
            </p>
            <h1 className="mt-3 font-serif text-5xl font-semibold">{user.name}</h1>
            <div className="mt-6 space-y-3 text-sm text-[var(--muted)]">
              <p>Email: {user.email || "не указан"}</p>
              <p>Телефон: {user.phone || "не указан"}</p>
              <p>Бонусный баланс: {user.customerProfile?.bonusBalance?.toString() ?? "0"} ₽</p>
            </div>
            <div className="mt-6">
              <ProfileDetailsForm user={user} />
            </div>
            <div className="mt-6">
              <LogoutButton />
            </div>
          </div>

          <div className="glass-panel rounded-[2.2rem] p-6">
            <h2 className="text-2xl font-semibold">Внутренние уведомления</h2>
            <div className="mt-4 space-y-3">
              {user.notifications.map((notification) => (
                <article key={notification.id} className="rounded-[1.5rem] bg-white/90 p-4">
                  <p className="font-semibold">
                    {notification.type === "REPLACEMENT_REQUIRED"
                      ? notification.title
                      : notificationTypeLabels[notification.type] ?? notification.title}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{notification.message}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {formatDateTimeLabel(notification.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[2.2rem] p-6">
          <h2 className="text-2xl font-semibold">Адресная книга</h2>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Храните домашний адрес, работу, офис и дополнительные комментарии для
            курьера.
          </p>
          <div className="mt-5">
            <AddressBook addresses={addresses} />
          </div>
        </div>
      </section>
    </MainShell>
  );
}
