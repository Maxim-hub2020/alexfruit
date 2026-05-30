import { format } from "date-fns";
import { Role } from "@/generated/prisma";
import { MainShell } from "@/components/layout/main-shell";
import { CourierDayRoute } from "@/components/courier/courier-day-route";
import { CourierHistory } from "@/components/courier/courier-history";
import { CourierRouteArchive } from "@/components/courier/courier-route-archive";
import { CourierTaskCard } from "@/components/courier/courier-task-card";
import { requirePageUser } from "@/lib/auth";
import { getCourierActiveTasks, getCourierDeliveryHistory } from "@/lib/orders";
import { toClientValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const courierTabs = ["history", "route", "today", "archive"] as const;
type CourierTab = (typeof courierTabs)[number];

const pageMeta: Record<CourierTab, { eyebrow: string; title: string; description: string }> = {
  history: {
    eyebrow: "История заказов",
    title: "История заказов",
    description:
      "Все завершённые доставки с поиском по адресу, клиенту, телефону и номеру заказа.",
  },
  route: {
    eyebrow: "Маршрут",
    title: "Маршрут на сегодня",
    description:
      "Один маршрут по всем активным заказам на день: список точек и кнопка открытия в Яндекс.Картах.",
  },
  today: {
    eyebrow: "Заказы на сегодня",
    title: "Заказы на сегодня",
    description:
      "Текущие назначенные заказы. После нажатия «Доставлено» заказ уйдёт в историю и архив маршрута.",
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

export default async function CourierPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser([Role.COURIER]);
  const params = await searchParams;
  const activeTab = getCourierTab(params.tab);
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const historyQuery = typeof params.history === "string" ? params.history : "";
  const archiveQuery = typeof params.archive === "string" ? params.archive : "";
  const historySearchQuery = activeTab === "archive" ? archiveQuery : historyQuery;
  const [activeTasks, historyTasks] = await Promise.all([
    getCourierActiveTasks(user.id, { date: todayKey }),
    getCourierDeliveryHistory(user.id, { query: historySearchQuery }),
  ]);
  const meta = pageMeta[activeTab];

  return (
    <MainShell active={`courier-${activeTab}`} user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            {meta.eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">{meta.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            {meta.description}
          </p>
        </div>

        {activeTab === "route" && (
          <>
            <CourierDayRoute
              tasks={activeTasks}
              routePdfUrl={`/api/courier/route-pdf?date=${todayKey}`}
            />
            {activeTasks.length === 0 && (
              <div className="glass-panel rounded-[2rem] p-8 text-center text-[var(--muted)]">
                На сегодня нет активных точек маршрута.
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
                Активных доставок на сегодня нет. Новые назначенные заказы появятся здесь.
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
