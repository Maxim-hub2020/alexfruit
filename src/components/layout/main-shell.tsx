import Link from "next/link";
import {
  LayoutDashboard,
  Truck,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { DesktopLiquidNav } from "@/components/layout/desktop-liquid-nav";
import { MobileLiquidNav } from "@/components/layout/mobile-liquid-nav";
import { LogoutButton } from "@/components/profile/logout-button";
import { APP_NAME, roleLabels } from "@/lib/constants";

type ShellUser = {
  name: string;
  role: string;
  notifications?: Array<unknown>;
};

export function MainShell({
  active,
  user,
  children,
}: {
  active?: string;
  user?: ShellUser | null;
  children: React.ReactNode;
}) {
  const isAdmin = user?.role === "ADMIN";
  const isCourier = user?.role === "COURIER";

  return (
    <div className="relative min-h-screen pb-28 pt-24 md:pt-28">
      <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3">
        <div className="liquid-app-header section-shell flex items-center justify-between gap-3 px-3 py-3 md:px-4">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <BrandLogo priority />
            <div className="hidden min-w-0 xl:block">
              <p className="truncate font-serif text-2xl font-semibold tracking-wide">{APP_NAME}</p>
              <p className="text-sm text-[var(--muted)]">
                Ростов-на-Дону, свежая доставка фруктов
              </p>
            </div>
          </Link>

          <DesktopLiquidNav active={active} role={user?.role} />

          <div className="flex shrink-0 items-center gap-2">
            {(isAdmin || isCourier) && (
              <Link
                href={isAdmin ? "/admin" : "/courier?tab=today"}
                className="hidden items-center gap-2 rounded-2xl bg-white/58 px-4 py-3 text-sm font-semibold text-[var(--foreground)] ring-1 ring-white/60 backdrop-blur-xl transition hover:bg-white/76 lg:inline-flex"
              >
                {isAdmin ? <LayoutDashboard size={16} /> : <Truck size={16} />}
                {isAdmin ? "Операционный центр" : "Кабинет курьера"}
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden rounded-[1.5rem] bg-white/46 px-4 py-3 ring-1 ring-white/60 backdrop-blur-xl lg:block">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-[var(--muted)]">{roleLabels[user.role]}</p>
                </div>
                <LogoutButton label="Выйти" className="w-auto px-4" />
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(47,143,79,0.24)]"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <MobileLiquidNav active={active} role={user?.role} />
    </div>
  );
}
