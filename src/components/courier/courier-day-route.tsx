import Link from "next/link";
import { FileText, MapPin, Navigation, Route } from "lucide-react";
import {
  buildYandexRouteUrl,
  routePointFromAddress,
  type CoordinateValue,
} from "@/lib/yandex-routes";

type CourierRouteTask = {
  id: string;
  status: string;
  routeOrder?: number | null;
  order: {
    status: string;
    orderNumber: string;
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

export function CourierDayRoute({
  tasks,
  routePdfUrl,
}: {
  tasks: CourierRouteTask[];
  routePdfUrl: string;
}) {
  const routeTasks = tasks
    .filter((task) => task.status !== "CANCELLED" && task.order.status !== "CANCELLED")
    .toSorted((a, b) => {
      const routeOrderA = a.routeOrder ?? 999;
      const routeOrderB = b.routeOrder ?? 999;

      return (
        routeOrderA - routeOrderB ||
        a.order.deliveryTimeSlot.title.localeCompare(b.order.deliveryTimeSlot.title)
      );
    });
  const routePoints = routeTasks.map((task) => routePointFromAddress(task.order.address));
  const routeUrl = buildYandexRouteUrl(routePoints, { includeStart: true });
  const pointsWithCoordinates = routePoints.filter(
    (point) => point.latitude !== null && point.longitude !== null,
  );

  return (
    <section className="glass-panel rounded-[2.2rem] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Route size={22} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Яндекс.Маршрут
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              Один маршрут по всем заказам
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {routeTasks.length} точек в списке, координаты есть у{" "}
              {pointsWithCoordinates.length}. Стартовая точка — Ростов-на-Дону,
              дальше Яндекс построит маршрут по адресам в порядке сборки.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={routeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(47,143,79,0.22)]"
          >
            <Navigation size={17} />
            Построить маршрут дня
          </Link>

          {routeTasks.length > 0 && (
            <Link
              href={routePdfUrl}
              target="_blank"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)]"
            >
              <FileText size={17} />
              Скачать PDF
            </Link>
          )}
        </div>
      </div>

      {routeTasks.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {routeTasks.slice(0, 12).map((task, index) => (
            <div key={task.id} className="rounded-[1.4rem] bg-white/82 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <p className="font-semibold">{task.order.orderNumber}</p>
              </div>
              <p className="mt-2 flex gap-2 text-sm text-[var(--muted)]">
                <MapPin size={15} className="mt-0.5 shrink-0" />
                <span>
                  {task.order.address.city}, {task.order.address.street},{" "}
                  {task.order.address.house} · {task.order.deliveryTimeSlot.title}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
