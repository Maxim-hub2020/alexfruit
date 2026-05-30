"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  BarChart3,
  Bell,
  ClipboardList,
  Home,
  PackageCheck,
  Route,
  ShoppingCart,
  ShoppingBasket,
  Truck,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_STATE_KEY = "alexfrut-desktop-nav-index";

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
  { key: "admin-products", href: "/admin/products", label: "Каталог", icon: ShoppingBasket },
  { key: "admin-couriers", href: "/admin/couriers", label: "Курьеры", icon: Truck },
  { key: "admin-analytics", href: "/admin/analytics", label: "Аналитика", icon: BarChart3 },
] as const;

const courierNavItems = [
  { key: "courier-history", href: "/courier?tab=history", label: "История", icon: ClipboardList },
  { key: "courier-route", href: "/courier?tab=route", label: "Маршрут", icon: Route },
  { key: "courier-today", href: "/courier?tab=today", label: "Сегодня", icon: PackageCheck },
  { key: "courier-archive", href: "/courier?tab=archive", label: "Архив", icon: Archive },
] as const;

function getNavItems(role?: string | null) {
  if (role === "ADMIN") {
    return adminNavItems;
  }

  if (role === "COURIER") {
    return courierNavItems;
  }

  return customerNavItems;
}

function getActiveIndex(items: ReturnType<typeof getNavItems>, active?: string) {
  return Math.max(
    0,
    items.findIndex((item) => item.key === active),
  );
}

function getStoredIndex(activeIndex: number, maxItems: number) {
  if (typeof window === "undefined") {
    return activeIndex;
  }

  const storedIndex = Number(globalThis.sessionStorage.getItem(NAV_STATE_KEY));

  return Number.isFinite(storedIndex) && storedIndex >= 0 && storedIndex < maxItems
    ? storedIndex
    : activeIndex;
}

export function DesktopLiquidNav({
  active,
  className,
  role,
}: {
  active?: string;
  className?: string;
  role?: string | null;
}) {
  const navItems = getNavItems(role);
  const activeIndex = getActiveIndex(navItems, active);
  const [motion, setMotion] = useState(() => ({
    visualIndex: activeIndex,
    previousIndex: activeIndex,
    isFlying: false,
  }));
  const { visualIndex, previousIndex, isFlying } = motion;
  const distance = Math.abs(activeIndex - previousIndex);
  const direction = activeIndex >= previousIndex ? "right" : "left";
  const navStyle = {
    "--nav-count": navItems.length,
    "--active-index": visualIndex,
    "--lens-stretch": isFlying ? Math.min(1.7, 1 + distance * 0.18) : 1,
  } as CSSProperties;

  useEffect(() => {
    const storedIndex = getStoredIndex(activeIndex, navItems.length);
    let settleFrameId = 0;
    const frameId = globalThis.requestAnimationFrame(() => {
      if (storedIndex !== activeIndex) {
        setMotion({
          visualIndex: storedIndex,
          previousIndex: storedIndex,
          isFlying: true,
        });

        settleFrameId = globalThis.requestAnimationFrame(() => {
          setMotion({
            visualIndex: activeIndex,
            previousIndex: storedIndex,
            isFlying: true,
          });
        });
        return;
      }

      setMotion((current) => {
        if (current.visualIndex === activeIndex && current.previousIndex === activeIndex) {
          return current;
        }

        return {
          ...current,
          visualIndex: activeIndex,
          isFlying: current.previousIndex !== activeIndex,
        };
      });
    });
    const timerId = globalThis.setTimeout(() => {
      globalThis.sessionStorage.setItem(NAV_STATE_KEY, String(activeIndex));
      setMotion({
        visualIndex: activeIndex,
        previousIndex: activeIndex,
        isFlying: false,
      });
    }, 620);

    return () => {
      globalThis.cancelAnimationFrame(frameId);
      globalThis.cancelAnimationFrame(settleFrameId);
      globalThis.clearTimeout(timerId);
    };
  }, [activeIndex, navItems.length]);

  return (
    <nav
      className={cn(
        "desktop-liquid-nav hidden md:grid",
        className,
        isFlying && "is-flying",
      )}
      data-direction={direction}
      style={navStyle}
      aria-label="Основная навигация"
    >
      <span className="desktop-liquid-lens" aria-hidden="true" />
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;

        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "desktop-liquid-item inline-flex items-center justify-center gap-2 rounded-[1.35rem] px-4 py-3 text-sm font-semibold",
              isActive && "is-active",
            )}
            onClick={() => {
              globalThis.sessionStorage.setItem(NAV_STATE_KEY, String(activeIndex));
            }}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
