import Link from "next/link";
import { MainShell } from "@/components/layout/main-shell";
import { LoginForm } from "@/components/storefront/auth-forms";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();

  return (
    <MainShell user={user}>
      <section className="section-shell relative isolate min-h-[calc(100vh-8rem)] py-8">
        <div
          aria-hidden="true"
          className="fixed inset-0 z-50 bg-[#eef5eb]/72 backdrop-blur-[10px]"
        />
        <div
          aria-hidden="true"
          className="fixed inset-0 z-50 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.45),transparent_30%),linear-gradient(180deg,rgba(245,248,240,0.42),rgba(238,245,235,0.8))]"
        />

        <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
          <div className="absolute left-4 top-10 h-32 w-56 rotate-[-7deg] rounded-[2rem] bg-white/42 shadow-[0_24px_80px_rgba(23,50,38,0.12)] ring-1 ring-white/50 blur-[1px]" />
          <div className="absolute right-0 top-24 h-40 w-72 rotate-[6deg] rounded-[2.4rem] bg-[#dff1dd]/44 shadow-[0_24px_90px_rgba(35,105,58,0.16)] ring-1 ring-white/60 blur-[2px]" />
          <div className="absolute bottom-10 left-1/2 h-28 w-80 -translate-x-1/2 rounded-[2rem] bg-white/36 shadow-[0_24px_80px_rgba(23,50,38,0.1)] blur-[2px]" />
        </div>

        <div className="login-produce-field" aria-hidden="true">
          <span
            className="login-produce-float float-apple"
            style={{ backgroundImage: "url('/products/apples.webp')" }}
          />
          <span
            className="login-produce-float float-berry"
            style={{ backgroundImage: "url('/products/strawberries.webp')" }}
          />
          <span
            className="login-produce-float float-tomato"
            style={{ backgroundImage: "url('/products/tomatoes.webp')" }}
          />
          <span
            className="login-produce-float float-mango"
            style={{ backgroundImage: "url('/products/mangoes.webp')" }}
          />
          <span
            className="login-produce-float float-pepper"
            style={{ backgroundImage: "url('/products/bell-peppers.webp')" }}
          />
          <span
            className="login-produce-float float-blueberry"
            style={{ backgroundImage: "url('/products/blueberries.webp')" }}
          />
        </div>

        <div className="relative z-[60] mx-auto max-w-xl rounded-[2.5rem] border border-white/72 bg-white/86 p-8 shadow-[0_34px_100px_rgba(23,50,38,0.22)] backdrop-blur-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Вход</p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">
            Фрукты для вас уже созрели
          </h1>
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
