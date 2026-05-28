import Link from "next/link";
import { MainShell } from "@/components/layout/main-shell";
import { LoginForm } from "@/components/storefront/auth-forms";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();

  return (
    <MainShell user={user}>
      <section className="section-shell py-8">
        <div className="mx-auto max-w-xl glass-panel rounded-[2.5rem] p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Вход</p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">Вернуться в систему</h1>
          <p className="mt-3 text-[var(--muted)]">
            Клиенты входят по номеру телефона и паролю. Для сотрудников также работает
            email из тестовых аккаунтов.
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
          <p className="mt-5 text-sm text-[var(--muted)]">
            Нет аккаунта?{" "}
            <Link href="/register" className="font-semibold text-[var(--accent-strong)]">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </section>
    </MainShell>
  );
}
