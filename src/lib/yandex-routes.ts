import { getMapAddressLabel } from "@/lib/utils";

export type CoordinateValue =
  | number
  | string
  | { toString(): string }
  | null
  | undefined;

export type RouteAddress = {
  city: string;
  street: string;
  house: string;
  apartment?: string | null;
  latitude?: CoordinateValue;
  longitude?: CoordinateValue;
};

export type RouteQueryPoint = {
  address: string;
  latitude: number | null;
  longitude: number | null;
};

export const ROSTOV_CENTER = {
  latitude: 47.2221,
  longitude: 39.7203,
};

const ROUTE_START_POINT: RouteQueryPoint = {
  address: "Ростов-на-Дону",
  latitude: ROSTOV_CENTER.latitude,
  longitude: ROSTOV_CENTER.longitude,
};

export function toCoordinate(value: CoordinateValue) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

export function routePointFromAddress(address: RouteAddress): RouteQueryPoint {
  return {
    address: getMapAddressLabel(address),
    latitude: toCoordinate(address.latitude),
    longitude: toCoordinate(address.longitude),
  };
}

function getPointQuery(point: RouteQueryPoint) {
  if (point.latitude !== null && point.longitude !== null) {
    return `${point.latitude},${point.longitude}`;
  }

  return point.address;
}

export function buildYandexRouteUrl(
  points: RouteQueryPoint[],
  options: { includeStart?: boolean } = {},
) {
  const url = new URL("https://yandex.ru/maps/");

  if (points.length === 0) {
    url.searchParams.set("text", "Ростов-на-Дону");
    return url.toString();
  }

  const routePoints =
    options.includeStart || points.length === 1
      ? [ROUTE_START_POINT, ...points]
      : points;

  url.searchParams.set("mode", "routes");
  url.searchParams.set("rtt", "auto");
  url.searchParams.set("rtext", routePoints.map(getPointQuery).join("~"));
  return url.toString();
}

export function buildYandexMapWidgetUrl(points: RouteQueryPoint[]) {
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

export function getRouteDistance(points: RouteQueryPoint[]) {
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
