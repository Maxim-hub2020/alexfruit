import {
  DeliveryTaskStatus,
  NotificationType,
  OrderStatus,
  type Prisma,
} from "@/generated/prisma";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { sendPushForNotifications } from "@/lib/push-notifications";

type GeoPoint = {
  latitude: number;
  longitude: number;
};

type CourierRouteTask = Prisma.DeliveryTaskGetPayload<{
  include: {
    order: {
      include: {
        address: true;
      };
    };
  };
}>;

type CourierLocationLike = {
  latitude: Prisma.Decimal | number | string;
  longitude: Prisma.Decimal | number | string;
  accuracy?: Prisma.Decimal | number | string | null;
  updatedAt: Date;
};

const ROSTOV_CENTER: GeoPoint = {
  latitude: 47.2221,
  longitude: 39.7203,
};
const CITY_TRAFFIC_MINUTES_PER_KM = 3.2;
const ROUTE_START_BUFFER_MINUTES = 5;
const ROUTE_STOP_SERVICE_MINUTES = 12;
const UNKNOWN_POINT_TRAVEL_MINUTES = 20;
const ROUTE_ETA_TASK_STATUSES: DeliveryTaskStatus[] = [
  DeliveryTaskStatus.ASSIGNED,
  DeliveryTaskStatus.IN_PROGRESS,
  DeliveryTaskStatus.ISSUE,
];
const ROUTE_ETA_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.HANDED_TO_COURIER,
  OrderStatus.COURIER_ON_THE_WAY,
  OrderStatus.DELIVERY_ISSUE,
];

export type CourierEtaDto = {
  distanceKm?: number | null;
  minutes: number;
  estimatedArrivalAt: string;
  updatedAt?: string | null;
  source: "route" | "gps";
};

export function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function toLocationDto(location: CourierLocationLike) {
  return {
    latitude: toNumber(location.latitude) ?? 0,
    longitude: toNumber(location.longitude) ?? 0,
    accuracy: toNumber(location.accuracy),
    updatedAt: location.updatedAt.toISOString(),
  };
}

export function getDistanceKm(first: GeoPoint, second: GeoPoint) {
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

export function getApproximateEtaMinutes(distanceKm: number) {
  return Math.max(
    5,
    Math.ceil(distanceKm * CITY_TRAFFIC_MINUTES_PER_KM + ROUTE_START_BUFFER_MINUTES),
  );
}

export function getOrderPoint(order: {
  address: {
    latitude?: Prisma.Decimal | number | string | null;
    longitude?: Prisma.Decimal | number | string | null;
  };
}) {
  const latitude = toNumber(order.address.latitude);
  const longitude = toNumber(order.address.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
}

export function formatEtaMinutes(minutes: number) {
  if (minutes < 60) {
    return `примерно через ${minutes} мин.`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0
    ? `примерно через ${hours} ч.`
    : `примерно через ${hours} ч. ${rest} мин.`;
}

export function formatArrivalTime(value: Date) {
  return value.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  });
}

function sortRouteTasks(tasks: CourierRouteTask[]) {
  return [...tasks].sort((first, second) => {
    const firstRouteOrder = first.routeOrder ?? Number.MAX_SAFE_INTEGER;
    const secondRouteOrder = second.routeOrder ?? Number.MAX_SAFE_INTEGER;

    return (
      firstRouteOrder - secondRouteOrder ||
      first.order.createdAt.getTime() - second.order.createdAt.getTime()
    );
  });
}

function getTravelMinutes(first: GeoPoint, second: GeoPoint) {
  return Math.max(
    4,
    Math.ceil(getDistanceKm(first, second) * CITY_TRAFFIC_MINUTES_PER_KM),
  );
}

function buildRouteEtaPlan(
  tasks: CourierRouteTask[],
  startPoint: GeoPoint,
  now: Date,
) {
  let currentPoint = startPoint;
  let elapsedMinutes = ROUTE_START_BUFFER_MINUTES;

  return sortRouteTasks(tasks).map((task) => {
    const orderPoint = getOrderPoint(task.order);
    const travelMinutes = orderPoint
      ? getTravelMinutes(currentPoint, orderPoint)
      : UNKNOWN_POINT_TRAVEL_MINUTES;

    elapsedMinutes += travelMinutes;

    const etaMinutes = Math.max(5, Math.ceil(elapsedMinutes));
    const estimatedArrivalAt = new Date(now.getTime() + etaMinutes * 60 * 1000);

    if (orderPoint) {
      currentPoint = orderPoint;
    }

    elapsedMinutes += ROUTE_STOP_SERVICE_MINUTES;

    return {
      task,
      etaMinutes,
      estimatedArrivalAt,
    };
  });
}

async function getCourierRouteTasks(courierId: string, deliveryDate: Date) {
  return prisma.deliveryTask.findMany({
    where: {
      courierId,
      status: { in: ROUTE_ETA_TASK_STATUSES },
      order: {
        is: {
          deliveryDate,
          status: { in: ROUTE_ETA_ORDER_STATUSES },
        },
      },
    },
    include: {
      order: {
        include: {
          address: true,
        },
      },
    },
    orderBy: [{ routeOrder: "asc" }, { order: { createdAt: "asc" } }],
  });
}

export async function startCourierRouteWithEta(taskId: string, courierId: string) {
  const selectedTask = await prisma.deliveryTask.findFirst({
    where: {
      id: taskId,
      courierId,
    },
    include: {
      order: true,
    },
  });

  if (!selectedTask) {
    throw new ApiError("Задание курьера не найдено", 404);
  }

  if (
    selectedTask.order.status === OrderStatus.CANCELLED ||
    selectedTask.order.status === OrderStatus.DELIVERED
  ) {
    throw new ApiError("Маршрут по этому заказу уже закрыт", 400);
  }

  const [tasks, courierLocation] = await Promise.all([
    getCourierRouteTasks(courierId, selectedTask.order.deliveryDate),
    prisma.courierLocation.findUnique({ where: { courierId } }),
  ]);

  const routeTasks = tasks.some((task) => task.id === taskId)
    ? tasks
    : [
        ...tasks,
        await prisma.deliveryTask.findUniqueOrThrow({
          where: { id: taskId },
          include: { order: { include: { address: true } } },
        }),
      ];
  const now = new Date();
  const startPoint = courierLocation
    ? {
        latitude: Number(courierLocation.latitude),
        longitude: Number(courierLocation.longitude),
      }
    : ROSTOV_CENTER;
  const etaPlan = buildRouteEtaPlan(routeTasks, startPoint, now);

  const { order, notifications } = await prisma.$transaction(async (tx) => {
    const createdNotifications = [];
    let selectedOrder = selectedTask.order;

    for (const item of etaPlan) {
      const task = item.task;
      const shouldNotify = !task.routeEtaNotificationSentAt;

      await tx.deliveryTask.update({
        where: { id: task.id },
        data: {
          status: DeliveryTaskStatus.IN_PROGRESS,
          routeStartedAt: task.routeStartedAt ?? now,
          estimatedArrivalAt: item.estimatedArrivalAt,
          etaMinutes: item.etaMinutes,
          etaUpdatedAt: now,
          routeEtaNotificationSentAt: shouldNotify
            ? now
            : task.routeEtaNotificationSentAt,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: task.orderId },
        data: {
          status: OrderStatus.COURIER_ON_THE_WAY,
        },
      });

      if (task.orderId === selectedTask.orderId) {
        selectedOrder = updatedOrder;
      }

      if (!shouldNotify) {
        continue;
      }

      createdNotifications.push(
        await tx.notification.create({
          data: {
            userId: task.order.userId,
            orderId: task.orderId,
            type: NotificationType.COURIER_ON_THE_WAY,
            title: "Курьер выехал",
            message: `Курьер по заказу ${task.order.orderNumber} будет ориентировочно в ${formatArrivalTime(
              item.estimatedArrivalAt,
            )} (${formatEtaMinutes(item.etaMinutes)}).`,
          },
        }),
      );
    }

    return {
      order: selectedOrder,
      notifications: createdNotifications,
    };
  });

  await sendPushForNotifications(notifications);

  return order;
}

export async function refreshCourierRouteEtaFromLocation(
  courierId: string,
  location: GeoPoint,
) {
  const tasks = await prisma.deliveryTask.findMany({
    where: {
      courierId,
      status: DeliveryTaskStatus.IN_PROGRESS,
      order: {
        is: {
          status: OrderStatus.COURIER_ON_THE_WAY,
        },
      },
    },
    include: {
      order: {
        include: {
          address: true,
        },
      },
    },
    orderBy: [{ routeOrder: "asc" }, { order: { createdAt: "asc" } }],
  });

  if (tasks.length === 0) {
    return;
  }

  const now = new Date();
  const etaPlan = buildRouteEtaPlan(tasks, location, now);

  await prisma.$transaction(
    etaPlan.map((item) =>
      prisma.deliveryTask.update({
        where: { id: item.task.id },
        data: {
          estimatedArrivalAt: item.estimatedArrivalAt,
          etaMinutes: item.etaMinutes,
          etaUpdatedAt: now,
        },
      }),
    ),
  );
}

export function getSavedCourierEta(task: {
  estimatedArrivalAt?: Date | null;
  etaMinutes?: number | null;
  etaUpdatedAt?: Date | null;
} | null | undefined): CourierEtaDto | null {
  if (!task) {
    return null;
  }

  if (!task.estimatedArrivalAt || !task.etaMinutes) {
    return null;
  }

  return {
    minutes: task.etaMinutes,
    estimatedArrivalAt: task.estimatedArrivalAt.toISOString(),
    updatedAt: task.etaUpdatedAt?.toISOString() ?? null,
    source: "route",
  };
}
