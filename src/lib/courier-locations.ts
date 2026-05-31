import {
  DeliveryTaskStatus,
  OrderStatus,
  Role,
  type Prisma,
} from "@/generated/prisma";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { courierLocationSchema } from "@/lib/validators";

const activeCourierTaskStatuses: DeliveryTaskStatus[] = [
  DeliveryTaskStatus.ASSIGNED,
  DeliveryTaskStatus.IN_PROGRESS,
  DeliveryTaskStatus.ISSUE,
];

const visibleCourierLocationStatuses: OrderStatus[] = [
  OrderStatus.COURIER_ON_THE_WAY,
  OrderStatus.DELIVERY_ISSUE,
];

const adminCurrentOrderStatuses: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.ASSEMBLING,
  OrderStatus.ASSEMBLED,
  OrderStatus.HANDED_TO_COURIER,
  OrderStatus.COURIER_ON_THE_WAY,
  OrderStatus.DELIVERY_ISSUE,
];

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toLocationDto(location: {
  latitude: Prisma.Decimal | number | string;
  longitude: Prisma.Decimal | number | string;
  accuracy?: Prisma.Decimal | number | string | null;
  updatedAt: Date;
}) {
  return {
    latitude: toNumber(location.latitude) ?? 0,
    longitude: toNumber(location.longitude) ?? 0,
    accuracy: toNumber(location.accuracy),
    updatedAt: location.updatedAt.toISOString(),
  };
}

function getDistanceKm(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
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

function getApproximateEtaMinutes(distanceKm: number) {
  const cityTrafficMinutesPerKm = 3.2;
  const dispatchBufferMinutes = 5;

  return Math.max(
    5,
    Math.ceil(distanceKm * cityTrafficMinutesPerKm + dispatchBufferMinutes),
  );
}

function getOrderPoint(order: {
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

export async function updateCourierLocation(courierId: string, input: unknown) {
  const data = courierLocationSchema.parse(input);

  return prisma.courierLocation.upsert({
    where: { courierId },
    update: {
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy ?? null,
    },
    create: {
      courierId,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy ?? null,
    },
  });
}

export async function getCourierLocation(courierId: string) {
  const location = await prisma.courierLocation.findUnique({
    where: { courierId },
  });

  return location ? toLocationDto(location) : null;
}

export async function getAdminCourierLocations() {
  const couriers = await prisma.user.findMany({
    where: {
      role: Role.COURIER,
      courierProfile: {
        is: {
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      courierProfile: {
        select: {
          name: true,
          phone: true,
        },
      },
      courierLocation: true,
      deliveryTasks: {
        where: {
          status: { in: activeCourierTaskStatuses },
          order: {
            is: {
              status: { in: adminCurrentOrderStatuses },
            },
          },
        },
        include: {
          order: {
            include: {
              address: true,
              deliveryTimeSlot: true,
            },
          },
        },
        orderBy: [{ routeOrder: "asc" }, { order: { createdAt: "asc" } }],
        take: 1,
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return couriers.map((courier) => {
    const task = courier.deliveryTasks[0];

    return {
      id: courier.id,
      name: courier.courierProfile?.name || courier.name,
      phone: courier.courierProfile?.phone || courier.phone,
      location: courier.courierLocation
        ? toLocationDto(courier.courierLocation)
        : null,
      currentOrder: task
        ? {
            orderNumber: task.order.orderNumber,
            status: task.order.status,
            address: task.order.address,
            deliveryTimeSlot: task.order.deliveryTimeSlot,
          }
        : null,
    };
  });
}

export async function getCustomerOrderCourierLocation(
  userId: string,
  orderId: string,
) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId,
    },
    include: {
      address: true,
      courier: {
        include: {
          courierProfile: true,
          courierLocation: true,
        },
      },
    },
  });

  if (!order) {
    throw new ApiError("Заказ не найден", 404);
  }

  const courier = order.courier;

  if (!courier) {
    return {
      available: false,
      reason: "Курьер пока не назначен.",
      orderStatus: order.status,
    };
  }

  const courierInfo = {
    name: courier.courierProfile?.name || courier.name,
    phone: courier.courierProfile?.phone || courier.phone,
  };

  if (!visibleCourierLocationStatuses.includes(order.status)) {
    return {
      available: false,
      reason: "Карта и прогноз появятся, когда курьер начнёт маршрут.",
      orderStatus: order.status,
      courier: courierInfo,
    };
  }

  if (!courier.courierLocation) {
    return {
      available: false,
      reason:
        "Курьер назначен, но геолокация ещё не включена или временно недоступна.",
      orderStatus: order.status,
      courier: courierInfo,
    };
  }

  const orderPoint = getOrderPoint(order);
  const location = toLocationDto(courier.courierLocation);
  const distanceKm =
    orderPoint === null
      ? null
      : getDistanceKm(
          {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          orderPoint,
        );

  return {
    available: true,
    orderStatus: order.status,
    courier: courierInfo,
    location,
    eta:
      distanceKm === null
        ? null
        : {
            distanceKm,
            minutes: getApproximateEtaMinutes(distanceKm),
          },
  };
}
