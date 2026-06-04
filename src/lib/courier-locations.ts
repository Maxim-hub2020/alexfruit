import {
  DeliveryTaskStatus,
  NotificationType,
  OrderStatus,
  Role,
} from "@/generated/prisma";
import { ApiError } from "@/lib/api";
import {
  getApproximateEtaMinutes,
  getDistanceKm,
  getOrderPoint,
  getSavedCourierEta,
  refreshCourierRouteEtaFromLocation,
  toLocationDto,
} from "@/lib/courier-eta";
import { prisma } from "@/lib/db";
import { sendPushForNotification } from "@/lib/push-notifications";
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
const ARRIVAL_NOTIFICATION_ETA_MINUTES = 15;

export async function updateCourierLocation(courierId: string, input: unknown) {
  const data = courierLocationSchema.parse(input);

  const location = await prisma.courierLocation.upsert({
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

  const locationDto = toLocationDto(location);

  await refreshCourierRouteEtaFromLocation(courierId, {
    latitude: locationDto.latitude,
    longitude: locationDto.longitude,
  });
  await notifyCustomersAboutArrivingCourier(courierId, locationDto);

  return location;
}

async function notifyCustomersAboutArrivingCourier(
  courierId: string,
  location: ReturnType<typeof toLocationDto>,
) {
  try {
    const tasks = await prisma.deliveryTask.findMany({
      where: {
        courierId,
        status: DeliveryTaskStatus.IN_PROGRESS,
        arrivalNotificationSent: false,
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
    });

    for (const task of tasks) {
      const orderPoint = getOrderPoint(task.order);

      if (!orderPoint) {
        continue;
      }

      const distanceKm = getDistanceKm(
        {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        orderPoint,
      );
      const etaMinutes = getApproximateEtaMinutes(distanceKm);

      if (etaMinutes > ARRIVAL_NOTIFICATION_ETA_MINUTES) {
        continue;
      }

      const notification = await prisma.$transaction(async (tx) => {
        const updatedTask = await tx.deliveryTask.updateMany({
          where: {
            id: task.id,
            arrivalNotificationSent: false,
          },
          data: {
            arrivalNotificationSent: true,
          },
        });

        if (updatedTask.count === 0) {
          return null;
        }

        return tx.notification.create({
          data: {
            userId: task.order.userId,
            orderId: task.orderId,
            type: NotificationType.COURIER_ARRIVING_SOON,
            title: "Курьер скоро будет",
            message: `Курьер по заказу ${task.order.orderNumber} будет примерно через ${etaMinutes} мин.`,
          },
        });
      });

      if (notification) {
        await sendPushForNotification(notification);
      }
    }
  } catch (error) {
    console.warn("Courier arrival notification failed", {
      message: error instanceof Error ? error.message : String(error),
      courierId,
    });
  }
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
      deliveryTask: true,
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
  const savedEta = getSavedCourierEta(order.deliveryTask);

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
      available: Boolean(savedEta),
      reason: savedEta
        ? "Карта появится после первого обновления геолокации курьера."
        : "Курьер назначен, но геолокация ещё не включена или временно недоступна.",
      orderStatus: order.status,
      courier: courierInfo,
      eta: savedEta,
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
      savedEta ??
      (distanceKm === null
        ? null
        : {
            distanceKm,
            minutes: getApproximateEtaMinutes(distanceKm),
            estimatedArrivalAt: new Date(
              Date.now() + getApproximateEtaMinutes(distanceKm) * 60 * 1000,
            ).toISOString(),
            updatedAt: location.updatedAt,
            source: "gps" as const,
          }),
  };
}
