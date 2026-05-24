import { format } from "date-fns";
import {
  DeliveryTaskStatus,
  NotificationType,
  OrderStatus,
  Prisma,
  ProblemType,
  Role,
} from "@/generated/prisma";
import { ApiError } from "@/lib/api";
import { DELIVERY_FEE, orderStatusMeta } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { dateStringToDbDate } from "@/lib/utils";
import {
  assignCourierSchema,
  createOrderSchema,
  courierProblemSchema,
  courierTaskStatusSchema,
  orderEditSchema,
  orderItemsSchema,
  orderRescheduleSchema,
  orderStatusSchema,
} from "@/lib/validators";

const orderStatusTitles: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.CONFIRMED]: "Заказ подтверждён",
  [OrderStatus.ASSEMBLED]: "Заказ собран",
  [OrderStatus.HANDED_TO_COURIER]: "Передан курьеру",
  [OrderStatus.COURIER_ON_THE_WAY]: "Курьер в пути",
  [OrderStatus.DELIVERED]: "Заказ доставлен",
  [OrderStatus.CANCELLED]: "Заказ отменён",
};

type OrderInputLine = {
  productId: string;
  quantity: number;
  actualQuantity?: number;
};

type AddressWithCoordinates = {
  latitude?: number | string | { toString(): string } | null;
  longitude?: number | string | { toString(): string } | null;
};

const MAX_SLOT_DISTANCE_KM = 2;

function createOrderNumber() {
  return `RD-${format(new Date(), "yyMMdd-HHmm")}-${Math.floor(
    1000 + Math.random() * 9000,
  )}`;
}

function toCoordinate(value: AddressWithCoordinates["latitude"]) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function getAddressPoint(address: AddressWithCoordinates) {
  const latitude = toCoordinate(address.latitude);
  const longitude = toCoordinate(address.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
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

function checkSlotDistance(
  candidateAddress: AddressWithCoordinates | null,
  existingOrders: Array<{
    orderNumber: string;
    address: AddressWithCoordinates;
  }>,
) {
  if (!candidateAddress) {
    return {
      available: false,
      reason: "Сначала выберите адрес доставки",
    };
  }

  const candidatePoint = getAddressPoint(candidateAddress);

  if (!candidatePoint) {
    return {
      available: false,
      reason: "У адреса нет координат, выберите адрес из подсказок",
    };
  }

  for (const order of existingOrders) {
    const existingPoint = getAddressPoint(order.address);

    if (!existingPoint) {
      return {
        available: false,
        reason: "В слоте есть заказ без координат",
      };
    }

    const distanceKm = getDistanceKm(candidatePoint, existingPoint);

    if (distanceKm > MAX_SLOT_DISTANCE_KM) {
      return {
        available: false,
        reason: `Слот уже собран в другой зоне: ${distanceKm.toFixed(1)} км`,
        distanceKm,
      };
    }
  }

  return {
    available: true,
    reason: null,
  };
}

async function createNotification(params: {
  userId: string;
  orderId?: string;
  type: NotificationType;
  title: string;
  message: string;
}) {
  return prisma.notification.create({
    data: params,
  });
}

function canCustomerEdit(order: {
  status: OrderStatus;
  editableUntil: Date;
}) {
  const editableStatuses: OrderStatus[] = [
    OrderStatus.NEW,
    OrderStatus.PENDING_CONFIRMATION,
  ];

  return (
    editableStatuses.includes(order.status) &&
    order.editableUntil.getTime() > Date.now()
  );
}

async function validateTimeSlotCapacity(
  deliveryDate: string,
  deliveryTimeSlotId: string,
  excludeOrderId?: string,
  candidateAddress?: AddressWithCoordinates,
) {
  const date = dateStringToDbDate(deliveryDate);
  const timeSlot = await prisma.deliveryTimeSlot.findUnique({
    where: { id: deliveryTimeSlotId },
  });

  if (!timeSlot || !timeSlot.isActive) {
    throw new ApiError("Временной слот недоступен", 400);
  }

  const ordersCount = await prisma.order.count({
    where: {
      deliveryDate: date,
      deliveryTimeSlotId,
      status: {
        not: OrderStatus.CANCELLED,
      },
      id: excludeOrderId ? { not: excludeOrderId } : undefined,
    },
  });

  if (ordersCount >= timeSlot.maxOrders) {
    throw new ApiError("Выбранный интервал уже заполнен", 409);
  }

  if (!candidateAddress) {
    return;
  }

  const existingOrders = await prisma.order.findMany({
    where: {
      deliveryDate: date,
      deliveryTimeSlotId,
      status: {
        not: OrderStatus.CANCELLED,
      },
      id: excludeOrderId ? { not: excludeOrderId } : undefined,
    },
    include: {
      address: true,
    },
  });
  const distanceCheck = checkSlotDistance(candidateAddress, existingOrders);

  if (!distanceCheck.available) {
    throw new ApiError(
      distanceCheck.reason ?? "Выбранный интервал уже занят другой зоной доставки",
      409,
    );
  }
}

async function buildOrderItems(items: OrderInputLine[]) {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isActive: true,
    },
  });

  if (products.length !== productIds.length) {
    throw new ApiError("Не все товары найдены или доступны для заказа", 400);
  }

  const productMap = new Map(products.map((product) => [product.id, product]));

  const itemRows = items.map((item) => {
    const product = productMap.get(item.productId);

    if (!product) {
      throw new ApiError("Товар не найден", 404);
    }

    const price = Number(product.price);
    const preliminarySum = price * item.quantity;
    const finalQuantity = item.actualQuantity ?? item.quantity;
    const finalSum = price * finalQuantity;

    return {
      productId: product.id,
      productName: product.name,
      price,
      unit: product.unit,
      orderedQuantity: item.quantity,
      actualQuantity: item.actualQuantity ?? null,
      preliminarySum,
      finalSum,
    };
  });

  const preliminaryTotal =
    itemRows.reduce((sum, item) => sum + item.preliminarySum, 0) + DELIVERY_FEE;
  const finalTotal =
    itemRows.reduce((sum, item) => sum + item.finalSum, 0) + DELIVERY_FEE;

  return {
    itemRows,
    preliminaryTotal,
    finalTotal,
  };
}

export async function getStorefrontData() {
  const [categories, products, timeSlots] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: [{ isPromo: "desc" }, { isHit: "desc" }, { createdAt: "desc" }],
    }),
    prisma.deliveryTimeSlot.findMany({
      where: { isActive: true },
      orderBy: { startTime: "asc" },
    }),
  ]);

  return {
    categories,
    products,
    timeSlots,
    highlights: {
      popular: products.filter((product) => product.isHit).slice(0, 6),
      seasonal: products.filter((product) => product.isNew).slice(0, 6),
      promo: products.filter((product) => product.isPromo).slice(0, 6),
    },
  };
}

export async function getAvailableTimeSlots(
  deliveryDate: string,
  filters: { userId?: string; addressId?: string | null } = {},
) {
  const date = dateStringToDbDate(deliveryDate);
  const candidateAddress = filters.addressId
    ? await prisma.address.findFirst({
        where: {
          id: filters.addressId,
          userId: filters.userId,
        },
      })
    : null;

  const [slots, counts, existingOrders] = await Promise.all([
    prisma.deliveryTimeSlot.findMany({
      where: { isActive: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.order.groupBy({
      by: ["deliveryTimeSlotId"],
      where: {
        deliveryDate: date,
        status: {
          not: OrderStatus.CANCELLED,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.order.findMany({
      where: {
        deliveryDate: date,
        status: {
          not: OrderStatus.CANCELLED,
        },
      },
      include: {
        address: true,
      },
    }),
  ]);

  const countsMap = new Map(
    counts.map((item) => [item.deliveryTimeSlotId, item._count._all]),
  );
  const ordersBySlot = new Map<string, typeof existingOrders>();

  for (const order of existingOrders) {
    const slotOrders = ordersBySlot.get(order.deliveryTimeSlotId) ?? [];

    slotOrders.push(order);
    ordersBySlot.set(order.deliveryTimeSlotId, slotOrders);
  }

  return slots.map((slot) => {
    const reserved = countsMap.get(slot.id) ?? 0;
    const hasCapacity = reserved < slot.maxOrders;
    const distanceCheck = checkSlotDistance(
      candidateAddress,
      ordersBySlot.get(slot.id) ?? [],
    );
    const available = hasCapacity && distanceCheck.available;

    return {
      ...slot,
      reserved,
      available,
      reason: hasCapacity ? distanceCheck.reason : "Слот заполнен",
      distanceLimitKm: MAX_SLOT_DISTANCE_KM,
    };
  });
}

export async function getCustomerOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    include: {
      items: true,
      address: true,
      deliveryTimeSlot: true,
      notifications: {
        where: {
          type: NotificationType.REPLACEMENT_REQUIRED,
          isRead: false,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomerOrderById(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: true,
      address: true,
      deliveryTimeSlot: true,
      courier: true,
    },
  });

  if (!order) {
    throw new ApiError("Заказ не найден", 404);
  }

  return order;
}

export async function createOrderForCustomer(userId: string, input: unknown) {
  const data = createOrderSchema.parse(input);
  const address = await prisma.address.findFirst({
    where: { id: data.addressId, userId },
  });

  if (!address) {
    throw new ApiError("Адрес не найден", 404);
  }

  await validateTimeSlotCapacity(
    data.deliveryDate,
    data.deliveryTimeSlotId,
    undefined,
    address,
  );
  const built = await buildOrderItems(data.items);

  const order = await prisma.order.create({
    data: {
      orderNumber: createOrderNumber(),
      userId,
      addressId: data.addressId,
      deliveryDate: dateStringToDbDate(data.deliveryDate),
      deliveryTimeSlotId: data.deliveryTimeSlotId,
      status: OrderStatus.NEW,
      preliminaryTotal: built.preliminaryTotal,
      finalTotal: built.finalTotal,
      customerComment: data.customerComment || null,
      editableUntil: new Date(Date.now() + 60 * 60 * 1000),
      items: {
        createMany: {
          data: built.itemRows,
        },
      },
    },
    include: {
      items: true,
      deliveryTimeSlot: true,
      address: true,
    },
  });

  await createNotification({
    userId,
    orderId: order.id,
    type: NotificationType.ORDER_CREATED,
    title: "Заказ оформлен",
    message: `Заказ ${order.orderNumber} принят в работу.`,
  });

  return order;
}

export async function updateOrderByCustomer(
  userId: string,
  orderId: string,
  input: unknown,
) {
  const data = orderEditSchema.parse(input);
  const existing = await prisma.order.findFirst({
    where: { id: orderId, userId },
  });

  if (!existing) {
    throw new ApiError("Заказ не найден", 404);
  }

  if (!canCustomerEdit(existing)) {
    throw new ApiError("Самостоятельное редактирование уже недоступно", 403);
  }

  const address = await prisma.address.findFirst({
    where: { id: data.addressId, userId },
  });

  if (!address) {
    throw new ApiError("Адрес не найден", 404);
  }

  await validateTimeSlotCapacity(
    data.deliveryDate,
    data.deliveryTimeSlotId,
    orderId,
    address,
  );
  const built = await buildOrderItems(data.items);

  const order = await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({
      where: { orderId },
    });

    return tx.order.update({
      where: { id: orderId },
      data: {
        addressId: data.addressId,
        deliveryDate: dateStringToDbDate(data.deliveryDate),
        deliveryTimeSlotId: data.deliveryTimeSlotId,
        customerComment: data.customerComment || null,
        preliminaryTotal: built.preliminaryTotal,
        finalTotal: built.finalTotal,
        status: data.status ?? existing.status,
        items: {
          createMany: {
            data: built.itemRows,
          },
        },
      },
      include: {
        items: true,
        address: true,
        deliveryTimeSlot: true,
      },
    });
  });

  await createNotification({
    userId,
    orderId: order.id,
    type: NotificationType.ORDER_UPDATED,
    title: "Заказ обновлён",
    message: `Изменения по заказу ${order.orderNumber} сохранены.`,
  });

  return order;
}

export async function rescheduleOrderByCustomer(
  userId: string,
  orderId: string,
  input: unknown,
) {
  const data = orderRescheduleSchema.parse(input);
  const existing = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      address: true,
      notifications: {
        where: {
          type: NotificationType.REPLACEMENT_REQUIRED,
          isRead: false,
        },
      },
    },
  });

  if (!existing) {
    throw new ApiError("Заказ не найден", 404);
  }

  const hasReplacementRequest = existing.notifications.length > 0;

  if (!hasReplacementRequest && !canCustomerEdit(existing)) {
    throw new ApiError("Перенос даты сейчас недоступен", 403);
  }

  await validateTimeSlotCapacity(
    data.deliveryDate,
    data.deliveryTimeSlotId,
    orderId,
    existing.address,
  );

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        deliveryDate: dateStringToDbDate(data.deliveryDate),
        deliveryTimeSlotId: data.deliveryTimeSlotId,
        status: OrderStatus.PENDING_CONFIRMATION,
      },
      include: {
        items: true,
        address: true,
        deliveryTimeSlot: true,
      },
    });

    await tx.notification.updateMany({
      where: {
        userId,
        orderId,
        type: NotificationType.REPLACEMENT_REQUIRED,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    await tx.notification.create({
      data: {
        userId,
        orderId,
        type: NotificationType.ORDER_UPDATED,
        title: "Дата доставки изменена",
        message: `По заказу ${updated.orderNumber} выбрана новая дата доставки ${data.deliveryDate}. Администратор подтвердит перенос.`,
      },
    });

    return updated;
  });

  return order;
}

export async function markOrderItemUnavailable(orderItemId: string) {
  const sourceItem = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: {
      order: true,
      product: true,
    },
  });

  if (!sourceItem) {
    throw new ApiError("Позиция заказа не найдена", 404);
  }

  const productName = sourceItem.product?.name ?? sourceItem.productName;
  const activeStatuses: OrderStatus[] = [
    OrderStatus.NEW,
    OrderStatus.PENDING_CONFIRMATION,
    OrderStatus.CONFIRMED,
    OrderStatus.ASSEMBLING,
  ];
  const affectedOrders = await prisma.order.findMany({
    where: {
      status: {
        in: activeStatuses,
      },
      items: {
        some: sourceItem.productId
          ? { productId: sourceItem.productId }
          : { productName: sourceItem.productName },
      },
    },
    include: {
      items: true,
      user: true,
      deliveryTimeSlot: true,
    },
  });

  if (affectedOrders.length === 0) {
    return {
      productName,
      affectedOrders: 0,
      notifiedCustomers: 0,
    };
  }

  const title = `Нужно выбрать новую дату: ${productName}`;
  const existingNotifications = await prisma.notification.findMany({
    where: {
      type: NotificationType.REPLACEMENT_REQUIRED,
      title,
      orderId: {
        in: affectedOrders.map((order) => order.id),
      },
    },
    select: {
      orderId: true,
    },
  });
  const alreadyNotifiedOrderIds = new Set(
    existingNotifications
      .map((notification) => notification.orderId)
      .filter(Boolean) as string[],
  );
  const ordersToNotify = affectedOrders.filter(
    (order) => !alreadyNotifiedOrderIds.has(order.id),
  );
  const message = `К сожалению, позиции «${productName}» сегодня нет в хорошем качестве. Пожалуйста, пройдите в личный кабинет и выберите другую дату доставки.`;

  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: {
        id: {
          in: affectedOrders.map((order) => order.id),
        },
      },
      data: {
        status: OrderStatus.PENDING_CONFIRMATION,
      },
    });

    if (ordersToNotify.length > 0) {
      await tx.notification.createMany({
        data: ordersToNotify.map((order) => ({
          userId: order.userId,
          orderId: order.id,
          type: NotificationType.REPLACEMENT_REQUIRED,
          title,
          message,
        })),
      });
    }
  });

  return {
    productName,
    affectedOrders: affectedOrders.length,
    notifiedCustomers: new Set(ordersToNotify.map((order) => order.userId)).size,
  };
}

export async function cancelOrderByCustomer(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
  });

  if (!order) {
    throw new ApiError("Заказ не найден", 404);
  }

  if (!canCustomerEdit(order)) {
    throw new ApiError("Отмена через кабинет уже недоступна", 403);
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.CANCELLED,
    },
  });

  await createNotification({
    userId,
    orderId: updated.id,
    type: NotificationType.ORDER_CANCELLED,
    title: "Заказ отменён",
    message: `Заказ ${updated.orderNumber} отменён.`,
  });

  return updated;
}

export async function repeatOrderItems(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw new ApiError("Заказ не найден", 404);
  }

  return order.items
    .filter((item) => item.productId && item.product)
    .map((item) => ({
      productId: item.productId!,
      name: item.productName,
      price: Number(item.price),
      unit: item.unit,
      imageUrl: item.product?.imageUrl,
      quantity: Number(item.orderedQuantity),
    }));
}

export async function getAdminDashboard() {
  const today = dateStringToDbDate(format(new Date(), "yyyy-MM-dd"));
  const todayOrders = await prisma.order.findMany({
    where: {
      deliveryDate: today,
    },
  });

  const revenue = todayOrders.reduce(
    (sum, order) => sum + Number(order.finalTotal ?? order.preliminaryTotal),
    0,
  );
  const assemblingStatuses: OrderStatus[] = [
    OrderStatus.CONFIRMED,
    OrderStatus.ASSEMBLING,
  ];
  const deliveryStatuses: OrderStatus[] = [
    OrderStatus.HANDED_TO_COURIER,
    OrderStatus.COURIER_ON_THE_WAY,
  ];

  return {
    ordersToday: todayOrders.length,
    newOrders: todayOrders.filter((order) => order.status === OrderStatus.NEW).length,
    assembling: todayOrders.filter((order) => assemblingStatuses.includes(order.status))
      .length,
    inDelivery: todayOrders.filter((order) => deliveryStatuses.includes(order.status))
      .length,
    delivered: todayOrders.filter((order) => order.status === OrderStatus.DELIVERED)
      .length,
    issues: todayOrders.filter((order) => order.status === OrderStatus.DELIVERY_ISSUE)
      .length,
    revenue,
  };
}

export async function getAdminOrders(filters: {
  date?: string | null;
  status?: string | null;
  customer?: string | null;
  courierId?: string | null;
  timeSlotId?: string | null;
}) {
  const where: Prisma.OrderWhereInput = {};

  if (filters.date) {
    where.deliveryDate = dateStringToDbDate(filters.date);
  }

  if (filters.status) {
    where.status = filters.status as OrderStatus;
  }

  if (filters.customer) {
    where.user = {
      OR: [
        { name: { contains: filters.customer, mode: "insensitive" } },
        { phone: { contains: filters.customer } },
        { email: { contains: filters.customer, mode: "insensitive" } },
      ],
    };
  }

  if (filters.courierId) {
    where.courierId = filters.courierId;
  }

  if (filters.timeSlotId) {
    where.deliveryTimeSlotId = filters.timeSlotId;
  }

  return prisma.order.findMany({
    where,
    include: {
      user: true,
      address: true,
      items: true,
      courier: true,
      deliveryTimeSlot: true,
    },
    orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function getAdminOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      address: true,
      items: true,
      courier: true,
      deliveryTimeSlot: true,
      deliveryTask: true,
    },
  });

  if (!order) {
    throw new ApiError("Заказ не найден", 404);
  }

  return order;
}

export async function updateOrderByAdmin(orderId: string, input: unknown) {
  const data = orderEditSchema.partial().parse(input);
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!existing) {
    throw new ApiError("Заказ не найден", 404);
  }

  const lockedStatuses: OrderStatus[] = [
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ];

  if (lockedStatuses.includes(existing.status)) {
    throw new ApiError("Завершённый заказ нельзя редактировать", 400);
  }

  if (data.deliveryDate || data.deliveryTimeSlotId || data.addressId) {
    const address = await prisma.address.findUnique({
      where: { id: data.addressId ?? existing.addressId },
    });

    await validateTimeSlotCapacity(
      data.deliveryDate ?? format(existing.deliveryDate, "yyyy-MM-dd"),
      data.deliveryTimeSlotId ?? existing.deliveryTimeSlotId,
      orderId,
      address ?? undefined,
    );
  }

  return prisma.order.update({
    where: { id: orderId },
    data: {
      addressId: data.addressId,
      deliveryDate: data.deliveryDate
        ? dateStringToDbDate(data.deliveryDate)
        : undefined,
      deliveryTimeSlotId: data.deliveryTimeSlotId,
      customerComment:
        data.customerComment === undefined ? undefined : data.customerComment || null,
      status: data.status,
    },
  });
}

export async function updateOrderStatusByAdmin(orderId: string, input: unknown) {
  const data = orderStatusSchema.parse(input);
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: data.status,
      adminComment:
        data.adminComment === undefined ? undefined : data.adminComment || null,
    },
  });

  const notificationTypeMap: Partial<Record<OrderStatus, NotificationType>> = {
    [OrderStatus.CONFIRMED]: NotificationType.ORDER_CONFIRMED,
    [OrderStatus.ASSEMBLED]: NotificationType.ORDER_ASSEMBLED,
    [OrderStatus.HANDED_TO_COURIER]: NotificationType.ORDER_HANDED_TO_COURIER,
    [OrderStatus.COURIER_ON_THE_WAY]: NotificationType.COURIER_ON_THE_WAY,
    [OrderStatus.DELIVERED]: NotificationType.ORDER_DELIVERED,
    [OrderStatus.CANCELLED]: NotificationType.ORDER_CANCELLED,
  };

  const type = notificationTypeMap[data.status];

  if (type) {
    await createNotification({
      userId: order.userId,
      orderId: order.id,
      type,
      title: orderStatusTitles[data.status] ?? "Статус обновлён",
      message: `Статус заказа ${order.orderNumber} изменён на "${
        orderStatusMeta[data.status]?.label ?? data.status
      }".`,
    });
  }

  return order;
}

export async function updateOrderItemsByAdmin(orderId: string, input: unknown) {
  const data = orderItemsSchema.parse(input);
  await getAdminOrder(orderId);
  const built = await buildOrderItems(data.items);

  return prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({
      where: { orderId },
    });

    return tx.order.update({
      where: { id: orderId },
      data: {
        preliminaryTotal: built.preliminaryTotal,
        finalTotal: built.finalTotal,
        items: {
          createMany: {
            data: built.itemRows,
          },
        },
      },
      include: {
        items: true,
      },
    });
  });
}

export async function assignCourierToOrder(orderId: string, input: unknown) {
  const data = assignCourierSchema.parse(input);
  const order = await getAdminOrder(orderId);

  if (!data.courierId) {
    return prisma.order.update({
      where: { id: orderId },
      data: { courierId: null },
    });
  }

  const courier = await prisma.user.findFirst({
    where: {
      id: data.courierId,
      role: Role.COURIER,
      courierProfile: {
        is: {
          isActive: true,
        },
      },
    },
  });

  if (!courier) {
    throw new ApiError("Курьер не найден", 404);
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      courierId: courier.id,
      status:
        order.status === OrderStatus.ASSEMBLED
          ? OrderStatus.HANDED_TO_COURIER
          : order.status,
    },
  });

  await prisma.deliveryTask.upsert({
    where: { orderId },
    update: {
      courierId: courier.id,
      status: DeliveryTaskStatus.ASSIGNED,
    },
    create: {
      orderId,
      courierId: courier.id,
      status: DeliveryTaskStatus.ASSIGNED,
    },
  });

  return updatedOrder;
}

export async function getDeliveryBoard(filters: {
  date?: string | null;
  courierId?: string | null;
  timeSlotId?: string | null;
}) {
  return prisma.order.findMany({
    where: {
      deliveryDate: filters.date ? dateStringToDbDate(filters.date) : undefined,
      courierId: filters.courierId || undefined,
      deliveryTimeSlotId: filters.timeSlotId || undefined,
      status: {
        in: [
          OrderStatus.CONFIRMED,
          OrderStatus.ASSEMBLING,
          OrderStatus.ASSEMBLED,
          OrderStatus.HANDED_TO_COURIER,
          OrderStatus.COURIER_ON_THE_WAY,
          OrderStatus.DELIVERY_ISSUE,
        ],
      },
    },
    include: {
      user: true,
      courier: true,
      address: true,
      deliveryTimeSlot: true,
      deliveryTask: true,
    },
    orderBy: [{ deliveryTimeSlot: { startTime: "asc" } }, { createdAt: "asc" }],
  });
}

export async function getOrdersForLabels(filters: { date: string }) {
  return prisma.order.findMany({
    where: {
      deliveryDate: dateStringToDbDate(filters.date),
      status: {
        not: OrderStatus.CANCELLED,
      },
    },
    include: {
      user: true,
      address: true,
      deliveryTimeSlot: true,
    },
    orderBy: [{ deliveryTimeSlot: { startTime: "asc" } }, { createdAt: "asc" }],
  });
}

export async function getOrdersForStaffPdf(filters: { date: string }) {
  return prisma.order.findMany({
    where: {
      deliveryDate: dateStringToDbDate(filters.date),
      status: {
        not: OrderStatus.CANCELLED,
      },
    },
    include: {
      user: true,
      address: true,
      items: true,
      courier: true,
      deliveryTimeSlot: true,
    },
    orderBy: [{ deliveryTimeSlot: { startTime: "asc" } }, { createdAt: "asc" }],
  });
}

const activeCourierTaskStatuses: DeliveryTaskStatus[] = [
  DeliveryTaskStatus.ASSIGNED,
  DeliveryTaskStatus.IN_PROGRESS,
  DeliveryTaskStatus.ISSUE,
];

function buildCourierHistorySearch(query?: string | null): Prisma.OrderWhereInput | undefined {
  const normalizedQuery = query?.trim();

  if (!normalizedQuery) {
    return undefined;
  }

  return {
    OR: [
      { orderNumber: { contains: normalizedQuery, mode: "insensitive" } },
      { user: { name: { contains: normalizedQuery, mode: "insensitive" } } },
      { user: { phone: { contains: normalizedQuery } } },
      { user: { email: { contains: normalizedQuery, mode: "insensitive" } } },
      { address: { city: { contains: normalizedQuery, mode: "insensitive" } } },
      { address: { street: { contains: normalizedQuery, mode: "insensitive" } } },
      { address: { house: { contains: normalizedQuery, mode: "insensitive" } } },
      { address: { apartment: { contains: normalizedQuery, mode: "insensitive" } } },
    ],
  };
}

export async function getCourierActiveTasks(
  userId: string,
  filters: { date?: string | null } = {},
) {
  return prisma.deliveryTask.findMany({
    where: {
      courierId: userId,
      status: {
        in: activeCourierTaskStatuses,
      },
      order: {
        is: {
          deliveryDate: filters.date ? dateStringToDbDate(filters.date) : undefined,
          status: {
            notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
          },
        },
      },
    },
    include: {
      order: {
        include: {
          user: true,
          address: true,
          deliveryTimeSlot: true,
          items: true,
        },
      },
    },
    orderBy: [{ order: { deliveryDate: "asc" } }, { routeOrder: "asc" }],
  });
}

export async function getCourierTasks(userId: string) {
  return getCourierActiveTasks(userId);
}

export async function getCourierDeliveryHistory(
  userId: string,
  filters: { query?: string | null } = {},
) {
  const orderSearch = buildCourierHistorySearch(filters.query);

  return prisma.deliveryTask.findMany({
    where: {
      courierId: userId,
      status: DeliveryTaskStatus.DELIVERED,
      order: orderSearch ? { is: orderSearch } : undefined,
    },
    include: {
      order: {
        include: {
          user: true,
          address: true,
          deliveryTimeSlot: true,
          items: true,
        },
      },
    },
    orderBy: [{ deliveredAt: "desc" }, { order: { deliveryDate: "desc" } }],
    take: 80,
  });
}

export async function updateCourierTaskStatus(
  taskId: string,
  courierUserId: string,
  input: unknown,
) {
  const data = courierTaskStatusSchema.parse(input);
  const task = await prisma.deliveryTask.findFirst({
    where: {
      id: taskId,
      courierId: courierUserId,
    },
    include: {
      order: true,
    },
  });

  if (!task) {
    throw new ApiError("Задание курьера не найдено", 404);
  }

  const nextOrderStatus =
    data.status === DeliveryTaskStatus.IN_PROGRESS
      ? OrderStatus.COURIER_ON_THE_WAY
      : data.status === DeliveryTaskStatus.DELIVERED
        ? OrderStatus.DELIVERED
        : task.order.status;

  await prisma.deliveryTask.update({
    where: { id: taskId },
    data: {
      status: data.status,
      deliveredAt:
        data.status === DeliveryTaskStatus.DELIVERED ? new Date() : undefined,
    },
  });

  return prisma.order.update({
    where: { id: task.order.id },
    data: {
      status: nextOrderStatus,
    },
  });
}

export async function reportCourierProblem(
  taskId: string,
  courierUserId: string,
  input: unknown,
) {
  const data = courierProblemSchema.parse(input);
  const task = await prisma.deliveryTask.findFirst({
    where: {
      id: taskId,
      courierId: courierUserId,
    },
    include: {
      order: true,
    },
  });

  if (!task) {
    throw new ApiError("Задание курьера не найдено", 404);
  }

  await prisma.deliveryTask.update({
    where: { id: taskId },
    data: {
      status: DeliveryTaskStatus.ISSUE,
      problemType: data.problemType as ProblemType,
      problemComment: data.problemComment || null,
    },
  });

  return prisma.order.update({
    where: { id: task.order.id },
    data: {
      status: OrderStatus.DELIVERY_ISSUE,
    },
  });
}
