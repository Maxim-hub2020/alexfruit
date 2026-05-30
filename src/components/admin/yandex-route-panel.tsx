import Link from "next/link";
import { MapPin, Navigation, Route, TriangleAlert } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { getAddressLabel, getMapAddressLabel } from "@/lib/utils";

type CoordinateValue = number | string | { toString(): string } | null | undefined;

type DeliveryRouteOrder = {
  id: string;
  orderNumber: string;
  status: string;
  courier?: { name: string } | null;
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
  deliveryTask?: {
    routeOrder?: number | null;
  } | null;
};

type RoutePoint = {
  address: string;
  courier: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
  order: DeliveryRouteOrder;
};

type RouteQueryPoint = Pick<RoutePoint, "address" | "latitude" | "longitude">;

const ROSTOV_CENTER = {
  latitude: 47.2221,
  longitude: 39.7203,
};

const ROUTE_START_POINT: RouteQueryPoint = {
  address: "Ростов-на-Дону",
  latitude: ROSTOV_CENTER.latitude,
  longitude: ROSTOV_CENTER.longitude,
};

function toCoordinate(value: CoordinateValue) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function getRoutePoint(order: DeliveryRouteOrder): RoutePoint {
  return {
    address: getMapAddressLabel(order.address),
    courier: order.courier?.name ?? "Без курьера",
    label: order.orderNumber,
    latitude: toCoordinate(order.address.latitude),
    longitude: toCoordinate(order.address.longitude),
    order,
  };
}

function getPointQuery(point: RouteQueryPoint) {
  if (point.latitude !== null && point.longitude !== null) {
    return `${point.latitude},${point.longitude}`;
  }

  return point.address;
}

function buildYandexRouteUrl(points: RoutePoint[]) {
  const url = new URL("https://yandex.ru/maps/");

  if (points.length === 0) {
    url.searchParams.set("text", points[0]?.address ?? "Ростов-на-Дону");
    return url.toString();
  }

  const routePoints =
    points.length === 1 ? [ROUTE_START_POINT, ...points] : points;

  url.searchParams.set("mode", "routes");
  url.searchParams.set("rtt", "auto");
  url.searchParams.set("rtext", routePoints.map(getPointQuery).join("~"));
  return url.toString();
}

function buildYandexMapWidgetUrl(points: RoutePoint[]) {
  const url = new URL("https://yandex.ru/map-widget/v1/");
  const pointsWithCoordinates = points.filter(
    (point) => point.latitude !== null && point.longitude !== null,
  );

  if (pointsWithCoordinates.length > 0) {
    const center = pointsWithCoordinates.reduce(
      (acc, point) => ({
        latitude: acc.latitude + point.latitude! / pointsWithCoordinates.length,
        longitude: acc.longitude + point.longitude! / pointsWithCoordinates.length,
      }),
      { latitude: 0, longitude: 0 },
    );

    url.searchParams.set("ll", `${center.longitude},${center.latitude}`);
    url.searchParams.set("z", pointsWithCoordinates.length > 1 ? "12" : "14");
    url.searchParams.set(
      "pt",
      pointsWithCoordinates
        .map(
          (point, index) =>
            `${point.longitude},${point.latitude},pm2gnm${Math.min(index + 1, 99)}`,
        )
        .join("~"),
    );
    return url.toString();
  }

  url.searchParams.set("ll", `${ROSTOV_CENTER.longitude},${ROSTOV_CENTER.latitude}`);
  url.searchParams.set("z", "11");
  url.searchParams.set("text", points[0]?.address ?? "Ростов-на-Дону");
  return url.toString();
}

function getDistanceKm(first: RouteQueryPoint, second: RouteQueryPoint) {
  if (
    first.latitude === null ||
    first.longitude === null ||
    second.latitude === null ||
    second.longitude === null
  ) {
    return null;
  }

  const radius = 6371;
  const latDelta = ((second.latitude - first.latitude) * Math.PI) / 180;
  const lonDelta = ((second.longitude - first.longitude) * Math.PI) / 180;
  const firstLat = (first.latitude * Math.PI) / 180;
  const secondLat = (second.latitude * Math.PI) / 180;
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(lonDelta / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getRouteDistance(points: RouteQueryPoint[]) {
  let knownSegments = 0;
  const distance = points.reduce((sum, point, index) => {
    if (index === 0) {
      return sum;
    }

    const segment = getDistanceKm(points[index - 1], point);

    if (segment === null) {
      return sum;
    }

    knownSegments += 1;
    return sum + segment;
  }, 0);

  return { distance, knownSegments };
}

function getSlotSummary(points: RoutePoint[]) {
  const counts = new Map<string, number>();

  for (const point of points) {
    const slot = point.order.deliveryTimeSlot.title;
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function getGroupedRoutes(points: RoutePoint[]) {
  const groups = new Map<string, RoutePoint[]>();

  for (const point of points) {
    const group = groups.get(point.courier) ?? [];
    group.push(point);
    groups.set(point.courier, group);
  }

  return [...groups.entries()].map(([courier, routePoints]) => ({
    courier,
    points: routePoints.sort((a, b) => {
      const routeOrderA = a.order.deliveryTask?.routeOrder ?? 999;
      const routeOrderB = b.order.deliveryTask?.routeOrder ?? 999;
      return (
        routeOrderA - routeOrderB ||
        a.order.deliveryTimeSlot.title.localeCompare(b.order.deliveryTimeSlot.title)
      );
    }),
  }));
}

export function YandexRoutePanel({ orders }: { orders: DeliveryRouteOrder[] }) {
  const routePoints = orders.map(getRoutePoint);
  const pointsWithCoordinates = routePoints.filter(
    (point) => point.latitude !== null && point.longitude !== null,
  );
  const missingCoordinates = routePoints.length - pointsWithCoordinates.length;
  const ordersWithoutCourier = routePoints.filter((point) => point.courier === "Без курьера");
  const groupedRoutes = getGroupedRoutes(routePoints);
  const slotSummary = getSlotSummary(routePoints);
  const busiestSlot = slotSummary[0];
  const distancePoints =
    routePoints.length === 1 ? [ROUTE_START_POINT, ...routePoints] : routePoints;
  const routeDistance = getRouteDistance(distancePoints);
  const mapUrl = buildYandexMapWidgetUrl(routePoints);
  const fullRouteUrl = buildYandexRouteUrl(routePoints);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="glass-panel overflow-hidden rounded-[2.2rem]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              Яндекс.Карты
            </p>
            <h2 className="mt-1 text-2xl font-semibold">Карта заказов на сегодня</h2>
          </div>
          <Link
            href={fullRouteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            <Navigation size={16} />
            Открыть маршрут
          </Link>
        </div>

        <iframe
          src={mapUrl}
          title="Карта заказов в Яндекс.Картах"
          className="h-[25rem] w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <aside className="glass-panel rounded-[2.2rem] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Route size={20} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Анализ маршрута
            </p>
            <h2 className="text-2xl font-semibold">{routePoints.length} заказов</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[1.5rem] bg-white/82 p-4">
            <p className="text-sm text-[var(--muted)]">Адресов с координатами</p>
            <p className="mt-2 text-3xl font-semibold">
              {pointsWithCoordinates.length}/{routePoints.length}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-white/82 p-4">
            <p className="text-sm text-[var(--muted)]">Примерная прямая дистанция</p>
            <p className="mt-2 text-3xl font-semibold">
              {routeDistance.knownSegments > 0
                ? `${routeDistance.distance.toFixed(1)} км`
                : "нет данных"}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-white/82 p-4">
            <p className="text-sm text-[var(--muted)]">Самое плотное окно</p>
            <p className="mt-2 text-lg font-semibold">
              {busiestSlot ? `${busiestSlot[0]} · ${busiestSlot[1]} заказ.` : "Нет заказов"}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-white/82 p-4">
            <p className="text-sm text-[var(--muted)]">Без курьера</p>
            <p className="mt-2 text-3xl font-semibold">{ordersWithoutCourier.length}</p>
          </div>
        </div>

        {(missingCoordinates > 0 || ordersWithoutCourier.length > 0) && (
          <div className="mt-5 rounded-[1.5rem] bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-100">
            <div className="flex gap-2">
              <TriangleAlert size={18} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                {missingCoordinates > 0 && (
                  <p>
                    {missingCoordinates} адрес(ов) без координат. Для точной оптимизации
                    подключим геокодер Яндекса через `YANDEX_MAPS_API_KEY`.
                  </p>
                )}
                {ordersWithoutCourier.length > 0 && (
                  <p>{ordersWithoutCourier.length} заказ(ов) нужно назначить курьеру.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>

      <div className="xl:col-span-2">
        <div className="grid gap-4 lg:grid-cols-2">
          {groupedRoutes.map((group) => (
            <article key={group.courier} className="glass-panel rounded-[2rem] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                    Курьер
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">{group.courier}</h3>
                </div>
                <Link
                  href={buildYandexRouteUrl(group.points)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--line)]"
                >
                  Маршрут
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {group.points.map((point, index) => (
                  <div key={point.order.id} className="rounded-[1.4rem] bg-white/82 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <p className="font-semibold">{point.order.orderNumber}</p>
                      <StatusPill status={point.order.status} />
                    </div>
                    <p className="mt-2 flex gap-2 text-sm text-[var(--muted)]">
                      <MapPin size={15} className="mt-0.5 shrink-0" />
                      <span>
                        {getAddressLabel(point.order.address)} · {point.order.deliveryTimeSlot.title}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
