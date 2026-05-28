import Link from "next/link";
import {
  Archive,
  BarChart3,
  Bell,
  ClipboardList,
  Home,
  LayoutDashboard,
  PackageCheck,
  Route,
  ShoppingCart,
  ShoppingBasket,
  Truck,
  UserRound,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { MobileLiquidNav } from "@/components/layout/mobile-liquid-nav";
import { LogoutButton } from "@/components/profile/logout-button";
import { APP_NAME, roleLabels } from "@/lib/constants";
import { cn } from "@/lib/utils";

type ShellUser = {
  name: string;
  role: string;
  notifications?: Array<unknown>;
};

const customerNavItems = [
  { key: "home", href: "/", label: "Главная", icon: Home },
  { key: "catalog", href: "/catalog", label: "Каталог", icon: ShoppingBasket },
  { key: "orders", href: "/orders", label: "Заказы", icon: ClipboardList },
  { key: "cart", href: "/cart", label: "Корзина", icon: ShoppingCart },
  { key: "profile", href: "/profile", label: "Профиль", icon: UserRound },
] as const;

const adminNavItems = [
  { key: "admin-orders", href: "/admin/orders", label: "Заказы", icon: Bell },
  { key: "admin-delivery", href: "/admin/delivery", label: "Сборка", icon: PackageCheck },
  {
    key: "admin-products",
    href: "/admin/products",
    label: "Каталог",
    desktopLabel: "Каталог и цены",
    icon: ShoppingBasket,
  },
  { key: "admin-couriers", href: "/admin/couriers", label: "Курьеры", icon: Truck },
  { key: "admin-analytics", href: "/admin/analytics", label: "Аналитика", icon: BarChart3 },
] as const;

const courierNavItems = [
  {
    key: "courier-history",
    href: "/courier?tab=history",
    label: "История",
    desktopLabel: "История заказов",
    icon: ClipboardList,
  },
  { key: "courier-route", href: "/courier?tab=route", label: "Маршрут", icon: Route },
  {
    key: "courier-today",
    href: "/courier?tab=today",
    label: "Сегодня",
    desktopLabel: "Заказы на сегодня",
    icon: PackageCheck,
  },
  {
    key: "courier-archive",
    href: "/courier?tab=archive",
    label: "Архив",
    desktopLabel: "Архив маршрута",
    icon: Archive,
  },
] as const;

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
  const desktopNavItems = isAdmin
    ? adminNavItems
    : isCourier
      ? courierNavItems
      : user
      ? customerNavItems
      : null;

  return (
    <div className="relative min-h-screen pb-28">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="section-shell flex items-center justify-between gap-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo priority />
            <div>
              <p className="font-serif text-2xl font-semibold tracking-wide">{APP_NAME}</p>
              <p className="text-sm text-[var(--muted)]">
                Ростов-на-Дону, свежая доставка фруктов
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {(isAdmin || isCourier) && (
              <Link
                href={isAdmin ? "/admin" : "/courier?tab=today"}
                className="hidden items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)] md:inline-flex"
              >
                {isAdmin ? <LayoutDashboard size={16} /> : <Truck size={16} />}
                {isAdmin ? "Операционный центр" : "Кабинет курьера"}
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <div className="glass-panel hidden rounded-[1.5rem] px-4 py-3 md:block">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-[var(--muted)]">{roleLabels[user.role]}</p>
                </div>
                <LogoutButton label="Выйти" className="w-auto px-4" />
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      {desktopNavItems && (
        <nav className="hidden border-b border-white/70 bg-[#f8fbf4]/82 backdrop-blur-xl md:block">
          <div className="section-shell flex items-center justify-center gap-2 py-3">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-white hover:text-[var(--accent-strong)]",
                    isActive && "bg-white text-[var(--accent-strong)] shadow-sm",
                  )}
                >
                  <Icon size={16} />
                  {"desktopLabel" in item ? item.desktopLabel : item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      <main>{children}</main>

      <MobileLiquidNav active={active} role={user?.role} />
    </div>
  );
}
