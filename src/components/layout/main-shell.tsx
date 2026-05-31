import { AppHeader } from "@/components/layout/app-header";
import { DesktopLiquidNav } from "@/components/layout/desktop-liquid-nav";
import { MobileLiquidNav } from "@/components/layout/mobile-liquid-nav";
import { cn } from "@/lib/utils";

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
  const homeHref = isAdmin ? "/admin" : isCourier ? "/courier?tab=today&day=today" : "/";

  return (
    <div
      className={cn(
        "relative min-h-screen pb-28 pt-24 md:pt-28",
        (isAdmin || isCourier) && "md:pb-40",
      )}
    >
      <AppHeader
        active={active}
        homeHref={homeHref}
        isAdmin={isAdmin}
        isCourier={isCourier}
        user={user}
      />

      <main>{children}</main>

      {isAdmin || isCourier ? (
        <div className="admin-nav-dock">
          <DesktopLiquidNav
            active={active}
            className={cn(
              "admin-desktop-liquid-nav",
              isCourier && "courier-desktop-liquid-nav",
            )}
            role={user?.role}
          />
        </div>
      ) : null}

      <MobileLiquidNav active={active} role={user?.role} />
    </div>
  );
}
