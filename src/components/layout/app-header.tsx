"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, PackageCheck, Truck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { DesktopLiquidNav } from "@/components/layout/desktop-liquid-nav";
import { LogoutButton } from "@/components/profile/logout-button";
import { APP_NAME, roleLabels } from "@/lib/constants";
import { cn } from "@/lib/utils";

type HeaderUser = {
  name: string;
  role: string;
  notifications?: Array<unknown>;
};

function isMobileViewport() {
  return globalThis.matchMedia("(max-width: 767px)").matches;
}

export function AppHeader({
  active,
  homeHref,
  isAdmin,
  isCourier,
  isPicker,
  user,
}: {
  active?: string;
  homeHref: string;
  isAdmin: boolean;
  isCourier: boolean;
  isPicker: boolean;
  user?: HeaderUser | null;
}) {
  const [isCompact, setIsCompact] = useState(false);
  const compactRef = useRef(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    function setCompact(nextCompact: boolean) {
      compactRef.current = nextCompact;
      setIsCompact(nextCompact);
    }

    function handleScroll() {
      if (!isMobileViewport()) {
        setCompact(false);
        lastScrollYRef.current = globalThis.scrollY;
        return;
      }

      const currentScrollY = globalThis.scrollY;
      const scrollDelta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY > 96 && scrollDelta > 8) {
        setCompact(true);
      }

      lastScrollYRef.current = currentScrollY;
    }

    lastScrollYRef.current = globalThis.scrollY;
    handleScroll();
    globalThis.addEventListener("scroll", handleScroll, { passive: true });
    globalThis.addEventListener("resize", handleScroll);

    return () => {
      globalThis.removeEventListener("scroll", handleScroll);
      globalThis.removeEventListener("resize", handleScroll);
    };
  }, []);

  function expandCompactHeader(event: React.MouseEvent<HTMLElement>) {
    if (!compactRef.current || !isMobileViewport()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    compactRef.current = false;
    setIsCompact(false);
  }

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 px-3 pt-3 transition-all duration-300 ease-out",
        isCompact && "mobile-header-compact",
      )}
    >
      <div className="liquid-app-header section-shell flex items-center justify-between gap-3 px-3 py-3 md:px-4">
        <Link
          href={homeHref}
          onClick={expandCompactHeader}
          className="flex min-w-0 items-center gap-3"
        >
          <BrandLogo priority />
          <div className="min-w-0 md:hidden">
            <p className="truncate font-serif text-lg font-semibold leading-tight">{APP_NAME}</p>
            <p className="truncate text-[0.68rem] font-medium text-[var(--muted)]">
              свежие овощи и фрукты
            </p>
          </div>
          <div className="hidden min-w-0 xl:block">
            <p className="truncate font-serif text-2xl font-semibold tracking-wide">{APP_NAME}</p>
            <p className="text-sm text-[var(--muted)]">
              Ростов-на-Дону, свежая доставка фруктов
            </p>
          </div>
        </Link>

        {!isAdmin && !isCourier && !isPicker ? (
          <DesktopLiquidNav active={active} role={user?.role} />
        ) : null}

        <div className="flex shrink-0 items-center gap-2">
          {(isAdmin || isCourier || isPicker) && (
            <Link
              href={isAdmin ? "/admin" : isCourier ? "/courier?tab=today&day=today" : "/picker"}
              className="hidden items-center gap-2 rounded-2xl bg-white/58 px-4 py-3 text-sm font-semibold text-[var(--foreground)] ring-1 ring-white/60 backdrop-blur-xl transition hover:bg-white/76 lg:inline-flex"
            >
              {isAdmin ? (
                <LayoutDashboard size={16} />
              ) : isCourier ? (
                <Truck size={16} />
              ) : (
                <PackageCheck size={16} />
              )}
              {isAdmin
                ? "Операционный центр"
                : isCourier
                  ? "Кабинет курьера"
                  : "Кабинет сборщика"}
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
  );
}
