import { Role } from "@/generated/prisma";
import { MainShell } from "@/components/layout/main-shell";
import { AddressBook } from "@/components/orders/address-book";
import { LogoutButton } from "@/components/profile/logout-button";
import { ProfileDetailsForm } from "@/components/profile/profile-details-form";
import { getUserAddresses } from "@/lib/addresses";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requirePageUser([Role.CUSTOMER]);
  const addresses = await getUserAddresses(user.id);

  return (
    <MainShell active="profile" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Профиль клиента
          </p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">{user.name}</h1>
          <div className="mt-6 space-y-3 text-sm text-[var(--muted)]">
            <p>Email: {user.email || "не указан"}</p>
            <p>Телефон: {user.phone || "не указан"}</p>
            <p>
              Бонусный баланс: {user.customerProfile?.bonusBalance?.toString() ?? "0"} ₽
            </p>
          </div>
          <div className="mt-6">
            <ProfileDetailsForm
              user={{
                name: user.name,
                email: user.email,
                phone: user.phone,
              }}
            />
          </div>
          <div className="mt-6">
            <LogoutButton />
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
