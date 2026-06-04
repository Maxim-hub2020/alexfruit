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
  MessageCircle,
  PackageCheck,
  PackageOpen,
  Route,
  ShoppingCart,
  ShoppingBasket,
  Truck,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_STATE_KEY = "alexfrut-mobile-nav-index";

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
  { key: "admin-inventory", href: "/admin/inventory", label: "Склад", icon: PackageOpen },
  { key: "admin-reviews", href: "/admin/reviews", label: "Клиенты", icon: MessageCircle },
  { key: "admin-couriers", href: "/admin/couriers", label: "Курьеры", icon: Truck },
  { key: "admin-analytics", href: "/admin/analytics", label: "Аналитика", icon: BarChart3 },
] as const;

const courierNavItems = [
  { key: "courier-today", href: "/courier?tab=today&day=today", label: "Заказы", icon: PackageCheck },
  { key: "courier-route", href: "/courier?tab=route&day=today", label: "Маршрут", icon: Route },
  { key: "courier-history", href: "/courier?tab=history", label: "История", icon: ClipboardList },
  { key: "courier-archive", href: "/courier?tab=archive", label: "Архив", icon: Archive },
  { key: "courier-profile", href: "/courier/profile", label: "Профиль", icon: UserRound },
] as const;

const pickerNavItems = [
  { key: "picker-assembly", href: "/picker", label: "Сборка", icon: PackageCheck },
] as const;

function getNavItems(role?: string | null) {
  if (role === "ADMIN") {
    return adminNavItems;
  }

  if (role === "COURIER") {
    return courierNavItems;
  }

  if (role === "PICKER") {
    return pickerNavItems;
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

export function MobileLiquidNav({
  active,
  role,
}: {
  active?: string;
  role?: string | null;
}) {
  const mobileNavItems = getNavItems(role);
  const activeIndex = getActiveIndex(mobileNavItems, active);
  const [motion, setMotion] = useState(() => ({
    visualIndex: activeIndex,
    previousIndex: activeIndex,
    isRolling: false,
  }));
  const { visualIndex, previousIndex, isRolling } = motion;
  const distance = Math.abs(activeIndex - previousIndex);
  const direction = activeIndex >= previousIndex ? "right" : "left";
  const mobileNavStyle = {
    "--nav-count": mobileNavItems.length,
    "--active-index": visualIndex,
    "--lens-stretch": isRolling ? Math.min(1.62, 1 + distance * 0.2) : 1,
  } as CSSProperties;

  useEffect(() => {
    const storedIndex = getStoredIndex(activeIndex, mobileNavItems.length);
    let settleFrameId = 0;
    const frameId = globalThis.requestAnimationFrame(() => {
      if (storedIndex !== activeIndex) {
        setMotion({
          visualIndex: storedIndex,
          previousIndex: storedIndex,
          isRolling: true,
        });

        settleFrameId = globalThis.requestAnimationFrame(() => {
          setMotion({
            visualIndex: activeIndex,
            previousIndex: storedIndex,
            isRolling: true,
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
          isRolling: current.previousIndex !== activeIndex,
        };
      });
    });
    const timerId = globalThis.setTimeout(() => {
      globalThis.sessionStorage.setItem(NAV_STATE_KEY, String(activeIndex));
      setMotion({
        visualIndex: activeIndex,
        previousIndex: activeIndex,
        isRolling: false,
      });
    }, 560);

    return () => {
      globalThis.cancelAnimationFrame(frameId);
      globalThis.cancelAnimationFrame(settleFrameId);
      globalThis.clearTimeout(timerId);
    };
  }, [activeIndex, mobileNavItems.length]);

  return (
    <nav className="fixed inset-x-0 bottom-4 z-30 px-4 md:hidden">
      <div
        className={cn("mobile-liquid-nav mx-auto grid max-w-md", isRolling && "is-rolling")}
        data-direction={direction}
        style={mobileNavStyle}
      >
        <span className="mobile-liquid-lens" aria-hidden="true" />
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "mobile-liquid-item flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-semibold",
                isActive && "is-active",
              )}
              onClick={() => {
                globalThis.sessionStorage.setItem(NAV_STATE_KEY, String(activeIndex));
              }}
            >
              <span className="mobile-liquid-icon">
                <Icon size={18} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
