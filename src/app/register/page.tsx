import { MainShell } from "@/components/layout/main-shell";
import { RegisterForm } from "@/components/storefront/auth-forms";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();

  return (
    <MainShell user={user}>
      <section className="section-shell py-8">
        <div className="mx-auto max-w-xl glass-panel rounded-[2.5rem] p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Новый номер
          </p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">Подтвердите телефон</h1>
          <p className="mt-3 text-[var(--muted)]">
            Сначала укажите телефон. Если номер свободен, подтвердите его через MAX
            и задайте пароль для следующего посещения.
          </p>
          <div className="mt-6">
            <RegisterForm />
          </div>
        </div>
      </section>
    </MainShell>
  );
}
