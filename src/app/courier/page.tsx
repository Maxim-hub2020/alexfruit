import { addDays, format } from "date-fns";
import Link from "next/link";
import { Role } from "@/generated/prisma";
import { MainShell } from "@/components/layout/main-shell";
import { CourierDayRoute } from "@/components/courier/courier-day-route";
import { CourierHistory } from "@/components/courier/courier-history";
import { CourierLocationShare } from "@/components/courier/courier-location-share";
import { CourierRouteArchive } from "@/components/courier/courier-route-archive";
import { CourierTaskCard } from "@/components/courier/courier-task-card";
import { requirePageUser } from "@/lib/auth";
import { getCourierActiveTasks, getCourierDeliveryHistory } from "@/lib/orders";
import { toClientValue } from "@/lib/serialize";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const courierTabs = ["history", "route", "today", "archive"] as const;
const courierDays = ["today", "tomorrow"] as const;

type CourierTab = (typeof courierTabs)[number];
type CourierDay = (typeof courierDays)[number];

const dayMeta: Record<
  CourierDay,
  {
    label: string;
    titlePart: string;
    emptyOrders: string;
    emptyRoute: string;
  }
> = {
  today: {
    label: "Сегодня",
    titlePart: "на сегодня",
    emptyOrders:
      "Активных доставок на сегодня нет. Новые назначенные заказы появятся здесь.",
    emptyRoute: "На сегодня нет активных точек маршрута.",
  },
  tomorrow: {
    label: "Завтра",
    titlePart: "на завтра",
    emptyOrders:
      "Активных доставок на завтра нет. Назначенные заранее заказы появятся здесь.",
    emptyRoute: "На завтра нет активных точек маршрута.",
  },
};

const staticPageMeta: Record<
  Exclude<CourierTab, "route" | "today">,
  { eyebrow: string; title: string; description: string }
> = {
  history: {
    eyebrow: "История заказов",
    title: "История заказов",
    description:
      "Все завершённые доставки с поиском по адресу, клиенту, телефону и номеру заказа.",
  },
  archive: {
    eyebrow: "Архив маршрута",
    title: "Архив маршрута",
    description:
      "Завершённые маршруты по дням: удобно проверить, где курьер был и когда закрыл точку.",
  },
};

function getCourierTab(value: string | string[] | undefined): CourierTab {
  if (typeof value === "string" && courierTabs.includes(value as CourierTab)) {
    return value as CourierTab;
  }

  return "today";
}

function getCourierDay(value: string | string[] | undefined): CourierDay {
  if (typeof value === "string" && courierDays.includes(value as CourierDay)) {
    return value as CourierDay;
  }

  return "today";
}

function getDateKey(day: CourierDay) {
  const baseDate = new Date();
  const deliveryDate = day === "tomorrow" ? addDays(baseDate, 1) : baseDate;

  return format(deliveryDate, "yyyy-MM-dd");
}

function getPageMeta(tab: CourierTab, day: CourierDay) {
  if (tab === "today") {
    return {
      eyebrow: `Заказы ${dayMeta[day].titlePart}`,
      title: `Заказы ${dayMeta[day].titlePart}`,
      description:
        "Текущие назначенные заказы. После нажатия «Доставлено» заказ уйдёт в историю и архив маршрута.",
    };
  }

  if (tab === "route") {
    return {
      eyebrow: "Маршрут",
      title: `Маршрут ${dayMeta[day].titlePart}`,
      description:
        "Один маршрут по активным заказам выбранного дня: список точек, Яндекс.Карты и PDF для печати.",
    };
  }

  return staticPageMeta[tab];
}

function buildCourierHref(tab: "today" | "route", day: CourierDay) {
  return `/courier?tab=${tab}&day=${day}`;
}

function CourierDaySwitch({
  activeTab,
  activeDay,
}: {
  activeTab: "today" | "route";
  activeDay: CourierDay;
}) {
  return (
    <div className="glass-panel inline-flex w-full rounded-[1.6rem] p-1 sm:w-auto">
      {courierDays.map((day) => {
        const isActive = day === activeDay;

        return (
          <Link
            key={day}
            href={buildCourierHref(activeTab, day)}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-[1.35rem] px-5 text-sm font-semibold transition sm:flex-none",
              isActive
                ? "bg-white text-[var(--accent-strong)] shadow-[0_16px_32px_rgba(47,143,79,0.14)] ring-1 ring-white/70"
                : "text-[var(--muted)] hover:bg-white/50 hover:text-[var(--foreground)]",
            )}
          >
            {dayMeta[day].label}
          </Link>
        );
      })}
    </div>
  );
}

export default async function CourierPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser([Role.COURIER]);
  const params = await searchParams;
  const activeTab = getCourierTab(params.tab);
  const activeDay = getCourierDay(params.day);
  const selectedDateKey = getDateKey(activeDay);
  const historyQuery = typeof params.history === "string" ? params.history : "";
  const archiveQuery = typeof params.archive === "string" ? params.archive : "";
  const historySearchQuery = activeTab === "archive" ? archiveQuery : historyQuery;
  const [activeTasks, historyTasks] = await Promise.all([
    getCourierActiveTasks(user.id, { date: selectedDateKey }),
    getCourierDeliveryHistory(user.id, { query: historySearchQuery }),
  ]);
  const meta = getPageMeta(activeTab, activeDay);

  return (
    <MainShell active={`courier-${activeTab}`} user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
                {meta.eyebrow}
              </p>
              <h1 className="mt-3 font-serif text-5xl font-semibold">{meta.title}</h1>
              <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
                {meta.description}
              </p>
            </div>

            {(activeTab === "today" || activeTab === "route") && (
              <CourierDaySwitch activeTab={activeTab} activeDay={activeDay} />
            )}
          </div>
        </div>

        {activeTab === "route" && (
          <>
            {activeDay === "today" && (
              <CourierLocationShare hasActiveTasks={activeTasks.length > 0} />
            )}
            <CourierDayRoute
              tasks={activeTasks}
              routePdfUrl={`/api/courier/route-pdf?date=${selectedDateKey}`}
            />
            {activeTasks.length === 0 && (
              <div className="glass-panel rounded-[2rem] p-8 text-center text-[var(--muted)]">
                {dayMeta[activeDay].emptyRoute}
              </div>
            )}
          </>
        )}

        {activeTab === "today" && (
          <div className="space-y-4">
            {activeTasks.map((task) => (
              <CourierTaskCard key={task.id} task={toClientValue(task as never)} />
            ))}

            {activeTasks.length === 0 && (
              <div className="glass-panel rounded-[2rem] p-8 text-center text-[var(--muted)]">
                {dayMeta[activeDay].emptyOrders}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <CourierHistory tasks={historyTasks} query={historyQuery} />
        )}

        {activeTab === "archive" && (
          <CourierRouteArchive tasks={historyTasks} query={archiveQuery} />
        )}
      </section>
    </MainShell>
  );
}
