import { format } from "date-fns";
import Link from "next/link";
import {
  Archive,
  CalendarDays,
  Clock,
  MapPin,
  Navigation,
  PackageCheck,
  Search,
} from "lucide-react";
import { formatDateLabel, formatDateTimeLabel, getAddressLabel } from "@/lib/utils";
import {
  buildYandexRouteUrl,
  routePointFromAddress,
  type CoordinateValue,
} from "@/lib/yandex-routes";
import { PhoneCallLink } from "@/components/ui/phone-call-link";

type CourierArchiveTask = {
  id: string;
  routeOrder?: number | null;
  deliveredAt?: Date | string | null;
  order: {
    orderNumber: string;
    updatedAt: Date | string;
    user: {
      name: string;
      phone?: string | null;
    };
    address: {
      city: string;
      street: string;
      house: string;
      apartment?: string | null;
      latitude?: CoordinateValue;
      longitude?: CoordinateValue;
    };
    deliveryTimeSlot: {
      title: string;
    };
  };
};

function getTaskDate(task: CourierArchiveTask) {
  return new Date(task.deliveredAt ?? task.order.updatedAt);
}

function groupTasksByDay(tasks: CourierArchiveTask[]) {
  return tasks.reduce<Map<string, CourierArchiveTask[]>>((groups, task) => {
    const dateKey = format(getTaskDate(task), "yyyy-MM-dd");
    const group = groups.get(dateKey) ?? [];

    group.push(task);
    groups.set(dateKey, group);

    return groups;
  }, new Map());
}

function sortRouteTasks(tasks: CourierArchiveTask[]) {
  return tasks.toSorted((a, b) => {
    const routeOrderA = a.routeOrder ?? 999;
    const routeOrderB = b.routeOrder ?? 999;

    return (
      routeOrderA - routeOrderB ||
      getTaskDate(a).getTime() - getTaskDate(b).getTime() ||
      a.order.deliveryTimeSlot.title.localeCompare(b.order.deliveryTimeSlot.title)
    );
  });
}

export function CourierRouteArchive({
  tasks,
  query,
}: {
  tasks: CourierArchiveTask[];
  query: string;
}) {
  const groupedTasks = Array.from(groupTasksByDay(tasks).entries());

  return (
    <section className="glass-panel rounded-[2.2rem] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Archive size={22} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Архив маршрутов
            </p>
            <h2 className="mt-1 text-2xl font-semibold">Архив маршрута</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Все завершённые точки сгруппированы по дням. Можно найти адрес,
              открыть старый маршрут и проверить, когда курьер был на конкретной точке.
            </p>
          </div>
        </div>

        <form action="/courier" className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="tab" value="archive" />
          <label className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              name="archive"
              defaultValue={query}
              placeholder="Адрес, клиент, маршрут"
              className="h-12 w-full min-w-[260px] rounded-2xl bg-white pl-10 pr-4 outline-none ring-1 ring-[var(--line)] sm:w-[320px]"
            />
          </label>
          <button className="h-12 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white">
            Найти
          </button>
          {query && (
            <Link
              href="/courier?tab=archive"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)]"
            >
              Сбросить
            </Link>
          )}
        </form>
      </div>

      <div className="mt-5 space-y-5">
        {groupedTasks.map(([dateKey, dayTasks]) => {
          const routeTasks = sortRouteTasks(dayTasks);
          const routePoints = routeTasks.map((task) => routePointFromAddress(task.order.address));
          const routeUrl = buildYandexRouteUrl(routePoints);

          return (
            <article key={dateKey} className="rounded-[1.7rem] bg-white/82 p-4 ring-1 ring-[var(--line)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarDays size={17} className="text-[var(--accent-strong)]" />
                    <h3 className="font-semibold">
                      {formatDateLabel(new Date(`${dateKey}T12:00:00.000Z`))}
                    </h3>
                    <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                      {routeTasks.length} точек
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Маршрут собран по фактически доставленным заказам этого дня.
                  </p>
                </div>

                <Link
                  href={routeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white"
                >
                  <Navigation size={17} />
                  Открыть маршрут дня
                </Link>
              </div>

              <div className="mt-4 grid gap-3">
                {routeTasks.map((task, index) => (
                  <div key={task.id} className="rounded-[1.35rem] bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
                            {index + 1}
                          </span>
                          <span className="font-semibold">{task.order.orderNumber}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                            <PackageCheck size={13} />
                            Доставлено
                          </span>
                        </div>
                        <p className="flex gap-2 text-sm text-[var(--muted)]">
                          <MapPin size={15} className="mt-0.5 shrink-0" />
                          <span>{getAddressLabel(task.order.address)}</span>
                        </p>
                        <p className="text-sm text-[var(--muted)]">
                          {task.order.user.name}
                          {task.order.user.phone ? ` · ${task.order.user.phone}` : ""}
                        </p>
                        <PhoneCallLink phone={task.order.user.phone} showPhone={false} />
                      </div>

                      <div className="rounded-[1.1rem] bg-[var(--surface-muted)] px-4 py-3 text-sm md:min-w-[220px]">
                        <p className="flex items-center gap-2 text-[var(--muted)]">
                          <Clock size={15} />
                          {formatDateTimeLabel(getTaskDate(task))}
                        </p>
                        <p className="mt-2 text-[var(--muted)]">
                          Окно: {task.order.deliveryTimeSlot.title}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}

        {tasks.length === 0 && (
          <div className="rounded-[1.7rem] bg-white/80 p-8 text-center text-[var(--muted)]">
            {query
              ? "По этому запросу архив маршрута пуст."
              : "Архив маршрута появится после первых завершённых доставок."}
          </div>
        )}
      </div>
    </section>
  );
}
