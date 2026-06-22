import { format } from "date-fns";
import {
  DeliveryTaskStatus,
  NotificationType,
  type Order,
  OrderStatus,
  Prisma,
  ProblemType,
  Role,
} from "@/generated/prisma";
import { ApiError } from "@/lib/api";
import {
  DELIVERY_FEE,
  labelPrintableOrderStatuses,
  orderStatusMeta,
} from "@/lib/constants";
import { startCourierRouteWithEta } from "@/lib/courier-eta";
import { prisma, readWithPrismaRetry } from "@/lib/db";
import {
  DEFAULT_DELIVERY_SLOT_CAPACITY,
  DEFAULT_DELIVERY_SLOT_END,
  DEFAULT_DELIVERY_SLOT_START,
  DEFAULT_DELIVERY_SLOT_TITLE,
  LIFT_SERVICE_FEE,
  getBusinessDateKey,
  getDeliveryDateAvailability,
  isTodayDeliveryClosed,
} from "@/lib/delivery-rules";
import {
  addDailyAvailabilityToProducts,
  completeDailyInventoryForLines,
  getInventoryDateFromOrder,
  type InventoryReservation,
  orderToInventoryLines,
  releaseDailyInventoryForLines,
  reserveDailyInventoryForLines,
  undoDailyInventoryForLines,
} from "@/lib/inventory";
import {
  sendPushForNotification,
  sendPushForNotifications,
} from "@/lib/push-notifications";
import { addReviewSummaryToProducts } from "@/lib/reviews";
import { dateStringToDbDate } from "@/lib/utils";
import {
  assignCourierSchema,
  bulkOrderStatusSchema,
  createOrderSchema,
  courierProblemSchema,
  courierTaskStatusSchema,
  orderActualItemsSchema,
  orderEditSchema,
  orderItemsSchema,
  orderRescheduleSchema,
  orderStatusSchema,
  replacementDecisionSchema,
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

type StorefrontProduct = Prisma.ProductGetPayload<{
  include: { category: true };
}>;

type OrderWriteClient = Prisma.TransactionClient | typeof prisma;

export type StorefrontCollectionItem = {
  productId: string;
  name: string;
  price: number;
  unit: string;
  imageUrl?: string | null;
  quantity: number;
};

export type StorefrontCollection = {
  key: string;
  eyebrow: string;
  title: string;
  text: string;
  source: "personal" | "fallback";
  items: StorefrontCollectionItem[];
};

const MAX_SLOT_DISTANCE_KM = 2;
const MIN_ORDER_NUMBER = 1000;
const MAX_ORDER_NUMBER = 9999;
const ORDER_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
} as const;
export const CUSTOMER_ORDER_EDIT_WINDOW_HOURS = 3;
const CUSTOMER_ORDER_EDIT_WINDOW_MS =
  CUSTOMER_ORDER_EDIT_WINDOW_HOURS * 60 * 60 * 1000;
export const customerEditableOrderStatuses: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.PENDING_CONFIRMATION,
  OrderStatus.CONFIRMED,
  OrderStatus.ASSEMBLING,
];
const routeAssignableOrderStatuses: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.PENDING_CONFIRMATION,
  OrderStatus.CONFIRMED,
  OrderStatus.ASSEMBLING,
  OrderStatus.ASSEMBLED,
  OrderStatus.HANDED_TO_COURIER,
  OrderStatus.COURIER_ON_THE_WAY,
  OrderStatus.DELIVERY_ISSUE,
];
const routeFinalOrderStatuses: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];
const ROSTOV_CENTER = {
  latitude: 47.2221,
  longitude: 39.7203,
};
const COURIER_LOAD_WEIGHT = 0.75;
const COURIER_OVERLOAD_WEIGHT = 3.5;
const COURIER_TARGET_ROUTE_ORDERS = 8;
const COURIER_EMPTY_ROUTE_START_PENALTY = 12;
const COURIER_MISSING_COORDINATE_PENALTY = 7;
const MIN_COURIER_ROUTE_ORDERS = 3;
const COURIER_MAIN_ROUTE_MERGE_BONUS = 1.5;
const SAME_STREET_BONUS = 6;
const ROUTE_AVERAGE_SPEED_KMH = 24;
const ROUTE_STOP_SERVICE_MINUTES = 12;
const unavailableProductTitlePrefixes = [
  "Сейчас нет: ",
  "Нужно выбрать новую дату: ",
];

async function createOrderNumber() {
  const orders = await prisma.order.findMany({
    select: { orderNumber: true },
  });
  const usedNumbers = new Set(orders.map((order) => order.orderNumber));
  const numericOrderNumbers = orders
    .map((order) => Number(order.orderNumber))
    .filter(
      (orderNumber) =>
        Number.isInteger(orderNumber) &&
        orderNumber >= MIN_ORDER_NUMBER &&
        orderNumber <= MAX_ORDER_NUMBER,
    );
  let nextNumber =
    numericOrderNumbers.length > 0
      ? Math.max(...numericOrderNumbers) + 1
      : MIN_ORDER_NUMBER;

  for (
    let attempts = 0;
    attempts <= MAX_ORDER_NUMBER - MIN_ORDER_NUMBER;
    attempts += 1
  ) {
    if (nextNumber > MAX_ORDER_NUMBER) {
      nextNumber = MIN_ORDER_NUMBER;
    }

    const candidate = String(nextNumber).padStart(4, "0");

    if (!usedNumbers.has(candidate)) {
      return candidate;
    }

    nextNumber += 1;
  }

  throw new ApiError("Свободные короткие номера заказов закончились", 500);
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

function normalizeRouteText(value?: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function hasSameDeliveryArea(
  candidateAddress: AddressWithCoordinates & {
    city?: string | null;
    street?: string | null;
  },
  existingAddress: AddressWithCoordinates & {
    city?: string | null;
    street?: string | null;
  },
) {
  const candidateCity = normalizeRouteText(candidateAddress.city);
  const existingCity = normalizeRouteText(existingAddress.city);
  const candidateStreet = normalizeRouteText(candidateAddress.street);
  const existingStreet = normalizeRouteText(existingAddress.street);

  return Boolean(
    candidateCity &&
      candidateStreet &&
      candidateCity === existingCity &&
      candidateStreet === existingStreet,
  );
}

function sortRouteItemsByDistance<
  T extends {
    createdAt: Date;
    address: AddressWithCoordinates;
    deliveryTask?: { routeOrder?: number | null } | null;
  },
>(items: T[]) {
  const remaining = [...items].sort((first, second) => {
    const firstOrder = first.deliveryTask?.routeOrder ?? Number.MAX_SAFE_INTEGER;
    const secondOrder = second.deliveryTask?.routeOrder ?? Number.MAX_SAFE_INTEGER;

    return firstOrder - secondOrder || first.createdAt.getTime() - second.createdAt.getTime();
  });
  const sorted: T[] = [];
  let currentPoint = ROSTOV_CENTER;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((item, index) => {
      const point = getAddressPoint(item.address);

      if (!point) {
        return;
      }

      const distance = getDistanceKm(currentPoint, point);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    if (!Number.isFinite(bestDistance)) {
      sorted.push(...remaining);
      break;
    }

    const [nextItem] = remaining.splice(bestIndex, 1);
    sorted.push(nextItem);
    currentPoint = getAddressPoint(nextItem.address) ?? currentPoint;
  }

  return sorted;
}

function getRouteDistanceForItems(items: Array<{ address: AddressWithCoordinates }>) {
  let currentPoint = ROSTOV_CENTER;
  let knownSegments = 0;
  const distanceKm = items.reduce((sum, item) => {
    const point = getAddressPoint(item.address);

    if (!point) {
      return sum;
    }

    knownSegments += 1;
    const distance = getDistanceKm(currentPoint, point);
    currentPoint = point;
    return sum + distance;
  }, 0);

  return { distanceKm, knownSegments };
}

function getRouteEtaMinutes(distanceKm: number, stopsCount: number) {
  return Math.round(
    (distanceKm / ROUTE_AVERAGE_SPEED_KMH) * 60 +
      stopsCount * ROUTE_STOP_SERVICE_MINUTES,
  );
}

function getAddressSectorIndex(address: AddressWithCoordinates, sectorsCount: number) {
  if (sectorsCount <= 1) {
    return 0;
  }

  const point = getAddressPoint(address);

  if (!point) {
    return null;
  }

  const latitudeDelta = point.latitude - ROSTOV_CENTER.latitude;
  const longitudeDelta =
    (point.longitude - ROSTOV_CENTER.longitude) *
    Math.cos((ROSTOV_CENTER.latitude * Math.PI) / 180);
  const angle = Math.atan2(longitudeDelta, latitudeDelta);
  const normalizedAngle = (angle + Math.PI * 2) % (Math.PI * 2);

  return Math.min(
    sectorsCount - 1,
    Math.floor(normalizedAngle / ((Math.PI * 2) / sectorsCount)),
  );
}

function scoreCourierForAddress(
  candidateAddress: AddressWithCoordinates & {
    city?: string | null;
    street?: string | null;
  },
  assignedOrders: Array<{
    address: AddressWithCoordinates & {
      city?: string | null;
      street?: string | null;
    };
  }>,
) {
  const candidatePoint = getAddressPoint(candidateAddress);
  const loadScore =
    assignedOrders.length * COURIER_LOAD_WEIGHT +
    Math.max(0, assignedOrders.length - COURIER_TARGET_ROUTE_ORDERS) *
      COURIER_OVERLOAD_WEIGHT;

  if (!candidatePoint) {
    const sameAreaBonus = assignedOrders.some((order) =>
      hasSameDeliveryArea(candidateAddress, order.address),
    )
      ? SAME_STREET_BONUS
      : 0;

    return loadScore + COURIER_MISSING_COORDINATE_PENALTY - sameAreaBonus;
  }

  if (assignedOrders.length === 0) {
    return (
      COURIER_EMPTY_ROUTE_START_PENALTY +
      getDistanceKm(ROSTOV_CENTER, candidatePoint)
    );
  }

  let nearestDistance = Number.POSITIVE_INFINITY;
  let missingCoordinates = 0;
  let sameAreaBonus = 0;

  for (const order of assignedOrders) {
    if (hasSameDeliveryArea(candidateAddress, order.address)) {
      sameAreaBonus = SAME_STREET_BONUS;
    }

    const point = getAddressPoint(order.address);

    if (!point) {
      missingCoordinates += 1;
      continue;
    }

    nearestDistance = Math.min(nearestDistance, getDistanceKm(candidatePoint, point));
  }

  const distanceScore = Number.isFinite(nearestDistance)
    ? nearestDistance
    : COURIER_MISSING_COORDINATE_PENALTY;

  return (
    loadScore +
    distanceScore +
    missingCoordinates * COURIER_MISSING_COORDINATE_PENALTY -
    sameAreaBonus
  );
}

async function reorderCourierRoute(
  client: OrderWriteClient,
  courierId: string,
  deliveryDate: Date,
) {
  const tasks = await client.deliveryTask.findMany({
    where: {
      courierId,
      status: {
        in: [
          DeliveryTaskStatus.ASSIGNED,
          DeliveryTaskStatus.IN_PROGRESS,
          DeliveryTaskStatus.ISSUE,
        ],
      },
      order: {
        deliveryDate,
        status: {
          notIn: routeFinalOrderStatuses,
        },
      },
    },
    include: {
      order: {
        include: {
          address: true,
          deliveryTask: {
            select: {
              routeOrder: true,
            },
          },
        },
      },
    },
  });
  const sortedTasks = sortRouteItemsByDistance(
    tasks.map((task) => ({
      id: task.id,
      createdAt: task.order.createdAt,
      address: task.order.address,
      deliveryTask: task.order.deliveryTask,
    })),
  );

  await Promise.all(
    sortedTasks.map((task, index) =>
      client.deliveryTask.update({
        where: { id: task.id },
        data: { routeOrder: index + 1 },
      }),
    ),
  );
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

function getUnavailableProductName(notification: {
  title: string;
  message: string;
}) {
  for (const prefix of unavailableProductTitlePrefixes) {
    if (notification.title.startsWith(prefix)) {
      return notification.title.slice(prefix.length).trim();
    }
  }

  return notification.message.match(/«(.+?)»/)?.[1]?.trim() ?? null;
}

async function getAutomaticCourierAssignment(
  client: OrderWriteClient,
  deliveryDate: Date,
  address: AddressWithCoordinates & {
    city?: string | null;
    street?: string | null;
  },
) {
  const couriers = await client.courier.findMany({
    where: {
      isActive: true,
      user: {
        role: Role.COURIER,
      },
    },
    select: {
      userId: true,
      name: true,
      user: {
        select: {
          assignedOrders: {
            where: {
              deliveryDate,
              status: {
                in: routeAssignableOrderStatuses,
              },
            },
            select: {
              id: true,
              createdAt: true,
              address: true,
              deliveryTask: {
                select: {
                  routeOrder: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  const sortedCouriers = couriers.toSorted((first, second) =>
    (first.name || "").localeCompare(second.name || "", "ru"),
  );
  const existingOrders = sortedCouriers.flatMap((courier) => courier.user.assignedOrders);
  const activeCouriers = sortedCouriers;
  const sectorIndex = getAddressSectorIndex(address, activeCouriers.length);
  const sectorCounts = Array.from({ length: activeCouriers.length }, () => 0);

  for (const order of existingOrders) {
    const orderSectorIndex = getAddressSectorIndex(order.address, activeCouriers.length);

    if (orderSectorIndex !== null) {
      sectorCounts[orderSectorIndex] += 1;
    }
  }

  if (sectorIndex !== null) {
    sectorCounts[sectorIndex] += 1;
  }

  const preferredCourier =
    sectorIndex !== null && sectorCounts[sectorIndex] >= MIN_COURIER_ROUTE_ORDERS
      ? activeCouriers[sectorIndex]
      : null;
  const courier =
    preferredCourier ??
    activeCouriers
      .map((item) => ({
        ...item,
        score: scoreCourierForAddress(address, item.user.assignedOrders),
      }))
      .toSorted((first, second) => {
        const scoreDiff = first.score - second.score;
        const activeRouteDiff =
          Number(first.user.assignedOrders.length === 0) -
          Number(second.user.assignedOrders.length === 0);
        const loadDiff =
          first.user.assignedOrders.length - second.user.assignedOrders.length;

        return (
          activeRouteDiff ||
          scoreDiff ||
          loadDiff ||
          first.name.localeCompare(second.name, "ru")
        );
      })[0];

  if (!courier) {
    return null;
  }

  return {
    courierId: courier.userId,
    routeOrder: courier.user.assignedOrders.length + 1,
  };
}

function getTotalsFromExistingItems(
  items: Array<{
    preliminarySum: number | string | { toString(): string };
    finalSum?: number | string | { toString(): string } | null;
  }>,
  liftFee: number | string | { toString(): string } | null | undefined = 0,
) {
  const extraFee = DELIVERY_FEE + Number(liftFee ?? 0);

  return {
    preliminaryTotal:
      items.reduce((sum, item) => sum + Number(item.preliminarySum), 0) +
      extraFee,
    finalTotal:
      items.reduce(
        (sum, item) => sum + Number(item.finalSum ?? item.preliminarySum),
        0,
      ) + extraFee,
  };
}

function getLiftFee(needsLift: boolean) {
  return needsLift ? LIFT_SERVICE_FEE : 0;
}

function assertCustomerDeliveryDateAvailable(
  deliveryDate: string,
  options: { allowTodayAfterCutoff?: boolean } = {},
) {
  const availability = getDeliveryDateAvailability(
    deliveryDate,
    new Date(),
    options,
  );

  if (!availability.available) {
    throw new ApiError(availability.reason ?? "Выберите другую дату доставки", 400);
  }
}

function assertSameDayOrderHasOnlyInventory(
  deliveryDate: string,
  items: Array<{ isPreorder: boolean }>,
) {
  const dateKey = deliveryDate.slice(0, 10);

  if (dateKey !== getBusinessDateKey() || !isTodayDeliveryClosed()) {
    return;
  }

  if (items.some((item) => item.isPreorder)) {
    throw new ApiError(
      "Сегодня можно оформить только товары, которые есть в наличии. Позиции под заказ выберите на завтра.",
      400,
    );
  }
}

async function getDefaultDeliveryTimeSlot(
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return client.deliveryTimeSlot.upsert({
    where: { title: DEFAULT_DELIVERY_SLOT_TITLE },
    update: {
      startTime: DEFAULT_DELIVERY_SLOT_START,
      endTime: DEFAULT_DELIVERY_SLOT_END,
      maxOrders: DEFAULT_DELIVERY_SLOT_CAPACITY,
      isActive: true,
    },
    create: {
      title: DEFAULT_DELIVERY_SLOT_TITLE,
      startTime: DEFAULT_DELIVERY_SLOT_START,
      endTime: DEFAULT_DELIVERY_SLOT_END,
      maxOrders: DEFAULT_DELIVERY_SLOT_CAPACITY,
      isActive: true,
    },
  });
}

async function createNotification(params: {
  userId: string;
  orderId?: string;
  type: NotificationType;
  title: string;
  message: string;
}) {
  const notification = await prisma.notification.create({
    data: params,
  });

  try {
    await sendPushForNotification(notification);
  } catch (error) {
    console.warn("Push notification failed after notification creation", {
      message: error instanceof Error ? error.message : String(error),
      notificationId: notification.id,
    });
  }

  return notification;
}

export function canCustomerEdit(order: {
  status: OrderStatus;
  editableUntil: Date;
}) {
  return (
    customerEditableOrderStatuses.includes(order.status) &&
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

async function buildOrderItems(
  items: OrderInputLine[],
  options: {
    needsLift?: boolean;
    inventoryReservations?: Map<string, InventoryReservation>;
  } = {},
) {
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
    const inventoryReservation = options.inventoryReservations?.get(product.id);
    const reservedQuantity = inventoryReservation?.reservedQuantity ?? 0;
    const isPreorder = Boolean(inventoryReservation?.isPreorder);

    return {
      productId: product.id,
      productName: product.name,
      price,
      unit: product.unit,
      orderedQuantity: item.quantity,
      actualQuantity: item.actualQuantity ?? null,
      reservedQuantity,
      isPreorder,
      preliminarySum,
      finalSum,
    };
  });

  const liftFee = getLiftFee(Boolean(options.needsLift));
  const extraFee = DELIVERY_FEE + liftFee;
  const preliminaryTotal =
    itemRows.reduce((sum, item) => sum + item.preliminarySum, 0) + extraFee;
  const finalTotal =
    itemRows.reduce((sum, item) => sum + item.finalSum, 0) + extraFee;

  return {
    itemRows,
    preliminaryTotal,
    finalTotal,
    liftFee,
  };
}

function aggregateSharedCartOrderItems(
  items: Array<{
    productId: string;
    quantity: number | string | { toString(): string };
  }>,
): OrderInputLine[] {
  const aggregated = new Map<string, number>();

  for (const item of items) {
    const quantity = Number(item.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    aggregated.set(item.productId, (aggregated.get(item.productId) ?? 0) + quantity);
  }

  return [...aggregated.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function normalizeCollectionQuantity(quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(quantity));
}

function createCollectionItem(
  product: StorefrontProduct,
  quantity = 1,
): StorefrontCollectionItem {
  return {
    productId: product.id,
    name: product.name,
    price: Number(product.price),
    unit: product.unit,
    imageUrl: product.imageUrl,
    quantity: normalizeCollectionQuantity(quantity),
  };
}

function mergeCollectionItems(items: StorefrontCollectionItem[]) {
  const merged = new Map<string, StorefrontCollectionItem>();

  for (const item of items) {
    const current = merged.get(item.productId);

    if (!current) {
      merged.set(item.productId, item);
      continue;
    }

    merged.set(item.productId, {
      ...current,
      quantity: current.quantity + item.quantity,
    });
  }

  return [...merged.values()];
}

function buildFallbackCollections(
  products: StorefrontProduct[],
  highlights: {
    popular: StorefrontProduct[];
    seasonal: StorefrontProduct[];
    promo: StorefrontProduct[];
  },
): StorefrontCollection[] {
  const fallbackProducts = products.slice(0, 3);

  return [
    {
      key: "popular",
      eyebrow: "Готовый старт",
      title: "Популярная корзина",
      text: "Несколько свежих позиций, с которых удобно начать заказ.",
      source: "fallback" as const,
      items: (highlights.popular.length > 0 ? highlights.popular : fallbackProducts)
        .slice(0, 3)
        .map((product) => createCollectionItem(product)),
    },
    {
      key: "seasonal",
      eyebrow: "Сезон прямо сейчас",
      title: "Ягоды, фрукты и зелень",
      text: "Свежие акценты для завтраков, салатов, лимонадов и лёгких ужинов.",
      source: "fallback" as const,
      items: (highlights.seasonal.length > 0 ? highlights.seasonal : fallbackProducts)
        .slice(0, 3)
        .map((product) => createCollectionItem(product)),
    },
    {
      key: "promo",
      eyebrow: "Когда хочется быстро",
      title: "Наборы и выгодные позиции",
      text: "Готовые решения на неделю, в гости или просто на холодильник без суеты.",
      source: "fallback" as const,
      items: (highlights.promo.length > 0 ? highlights.promo : fallbackProducts)
        .slice(0, 3)
        .map((product) => createCollectionItem(product)),
    },
  ].filter((collection) => collection.items.length > 0);
}

async function buildStorefrontCollections(
  userId: string | undefined,
  products: StorefrontProduct[],
  highlights: {
    popular: StorefrontProduct[];
    seasonal: StorefrontProduct[];
    promo: StorefrontProduct[];
  },
) {
  const fallbackCollections = buildFallbackCollections(products, highlights);

  if (!userId) {
    return fallbackCollections;
  }

  const recentOrders = await prisma.order.findMany({
    where: {
      userId,
      status: {
        not: OrderStatus.CANCELLED,
      },
    },
    include: {
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  if (recentOrders.length === 0) {
    return fallbackCollections;
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const latestOrderItems = mergeCollectionItems(
    recentOrders[0].items
      .map((item) => {
        const product = item.productId ? productMap.get(item.productId) : null;

        return product
          ? createCollectionItem(product, Number(item.orderedQuantity))
          : null;
      })
      .filter((item): item is StorefrontCollectionItem => Boolean(item)),
  ).slice(0, 4);
  const stats = new Map<
    string,
    {
      product: StorefrontProduct;
      orderHits: number;
      totalQuantity: number;
      latestOrderIndex: number;
      latestQuantity: number;
    }
  >();

  recentOrders.forEach((order, orderIndex) => {
    const seenInOrder = new Set<string>();

    for (const item of order.items) {
      const product = item.productId ? productMap.get(item.productId) : null;

      if (!product) {
        continue;
      }

      const quantity = Number(item.orderedQuantity);
      const current = stats.get(product.id) ?? {
        product,
        orderHits: 0,
        totalQuantity: 0,
        latestOrderIndex: Number.POSITIVE_INFINITY,
        latestQuantity: 1,
      };

      current.totalQuantity += Number.isFinite(quantity) ? quantity : 1;

      if (!seenInOrder.has(product.id)) {
        current.orderHits += 1;
        seenInOrder.add(product.id);
      }

      if (orderIndex < current.latestOrderIndex) {
        current.latestOrderIndex = orderIndex;
        current.latestQuantity = quantity;
      }

      stats.set(product.id, current);
    }
  });

  const favoriteStats = [...stats.values()].sort((first, second) => {
    const hitsDiff = second.orderHits - first.orderHits;

    if (hitsDiff !== 0) {
      return hitsDiff;
    }

    const quantityDiff = second.totalQuantity - first.totalQuantity;

    if (quantityDiff !== 0) {
      return quantityDiff;
    }

    return first.latestOrderIndex - second.latestOrderIndex;
  });
  const favoriteItems = favoriteStats
    .slice(0, 4)
    .map((stat) => createCollectionItem(stat.product, stat.latestQuantity));
  const categoryWeights = new Map<string, number>();

  for (const stat of favoriteStats) {
    categoryWeights.set(
      stat.product.categoryId,
      (categoryWeights.get(stat.product.categoryId) ?? 0) + stat.orderHits,
    );
  }

  const usedProductIds = new Set([
    ...latestOrderItems.map((item) => item.productId),
    ...favoriteItems.map((item) => item.productId),
  ]);
  const preferredCategoryIds = [...categoryWeights.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([categoryId]) => categoryId);
  const similarItems: StorefrontCollectionItem[] = [];

  for (const categoryId of preferredCategoryIds) {
    for (const product of products) {
      if (
        product.categoryId !== categoryId ||
        usedProductIds.has(product.id) ||
        similarItems.some((item) => item.productId === product.id)
      ) {
        continue;
      }

      similarItems.push(createCollectionItem(product));

      if (similarItems.length >= 4) {
        break;
      }
    }

    if (similarItems.length >= 4) {
      break;
    }
  }

  const personalCollections: StorefrontCollection[] = [];

  if (latestOrderItems.length > 0) {
    personalCollections.push({
      key: "personal-latest",
      eyebrow: "На основе прошлого заказа",
      title: "Повторить последнюю корзину",
      text: "Собрали позиции из вашего последнего заказа, чтобы можно было быстро стартовать и поправить детали в корзине.",
      source: "personal",
      items: latestOrderItems,
    });
  }

  if (favoriteItems.length > 0) {
    personalCollections.push({
      key: "personal-favorites",
      eyebrow: "По вашей истории",
      title: "Ваши частые покупки",
      text: "То, что чаще всего появлялось в ваших заказах: удобно добавить всё одним нажатием.",
      source: "personal",
      items: favoriteItems,
    });
  }

  if (similarItems.length > 0) {
    personalCollections.push({
      key: "personal-similar",
      eyebrow: "Похоже на ваши заказы",
      title: "Можно докинуть к привычному",
      text: "Дополнительные позиции из любимых категорий, которые хорошо ложатся в вашу обычную корзину.",
      source: "personal",
      items: similarItems,
    });
  }

  for (const fallbackCollection of fallbackCollections) {
    if (personalCollections.length >= 3) {
      break;
    }

    personalCollections.push({
      ...fallbackCollection,
      key: `fallback-${fallbackCollection.key}`,
    });
  }

  return personalCollections.slice(0, 3);
}

export async function getStorefrontData(userId?: string, deliveryDate?: string | null) {
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
  const productsWithAvailability = await addReviewSummaryToProducts(
    await addDailyAvailabilityToProducts(
      products,
      deliveryDate,
    ),
  );
  const availableProducts = productsWithAvailability.filter(
    (product) => product.isAvailableForDate,
  );
  const pickHighlightedProducts = (
    predicate: (product: (typeof productsWithAvailability)[number]) => boolean,
  ) => {
    const matchedProducts = productsWithAvailability.filter(predicate);
    const matchedAvailableProducts = matchedProducts.filter(
      (product) => product.isAvailableForDate,
    );
    const matchedPreorderProducts = matchedProducts.filter(
      (product) => !product.isAvailableForDate,
    );

    return [...matchedAvailableProducts, ...matchedPreorderProducts].slice(0, 6);
  };
  const highlights = {
    popular: pickHighlightedProducts((product) => product.isHit),
    seasonal: pickHighlightedProducts((product) => product.isNew),
    promo: pickHighlightedProducts((product) => product.isPromo),
  };
  const availableHighlights = {
    popular: availableProducts.filter((product) => product.isHit).slice(0, 6),
    seasonal: availableProducts.filter((product) => product.isNew).slice(0, 6),
    promo: availableProducts.filter((product) => product.isPromo).slice(0, 6),
  };

  return {
    categories,
    products: productsWithAvailability,
    timeSlots,
    highlights,
    collections: await buildStorefrontCollections(userId, availableProducts, availableHighlights),
  };
}

export async function getAvailableTimeSlots(
  deliveryDate: string,
  filters: {
    userId?: string;
    addressId?: string | null;
    excludeOrderId?: string | null;
  } = {},
) {
  const date = dateStringToDbDate(deliveryDate);
  const deliveryDateAvailability = getDeliveryDateAvailability(deliveryDate);
  const candidateAddress = filters.addressId
    ? await prisma.address.findFirst({
        where: {
          id: filters.addressId,
          userId: filters.userId,
          isDeleted: false,
        },
      })
    : null;
  const editableOrder = filters.excludeOrderId
    ? await prisma.order.findFirst({
        where: {
          id: filters.excludeOrderId,
          userId: filters.userId,
        },
        select: { id: true },
      })
    : null;
  const excludeOrderId = editableOrder?.id;

  const [slots, counts, existingOrders] = await Promise.all([
    prisma.deliveryTimeSlot.findMany({
      where: { isActive: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.order.groupBy({
      by: ["deliveryTimeSlotId"],
      where: {
        deliveryDate: date,
        id: excludeOrderId ? { not: excludeOrderId } : undefined,
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
        id: excludeOrderId ? { not: excludeOrderId } : undefined,
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
    if (!deliveryDateAvailability.available) {
      return {
        ...slot,
        reserved,
        available: false,
        reason: deliveryDateAvailability.reason,
        distanceLimitKm: MAX_SLOT_DISTANCE_KM,
      };
    }

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
      items: {
        include: {
          review: {
            include: {
              photos: true,
            },
          },
        },
      },
      address: true,
      sharedCart: {
        select: {
          id: true,
          token: true,
          title: true,
        },
      },
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
  assertCustomerDeliveryDateAvailable(data.deliveryDate, {
    allowTodayAfterCutoff: true,
  });
  const [address, sharedCart] = await Promise.all([
    prisma.address.findFirst({
      where: { id: data.addressId, userId, isDeleted: false },
    }),
    data.sharedCartToken
      ? prisma.sharedCart.findFirst({
          where: {
            token: data.sharedCartToken,
            isActive: true,
          },
          include: {
            items: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (!address) {
    throw new ApiError("Адрес не найден", 404);
  }

  if (data.sharedCartToken) {
    if (!sharedCart) {
      throw new ApiError("Общая корзина не найдена", 404);
    }

    if (sharedCart.ownerId !== userId) {
      throw new ApiError("Оформить общую корзину может только её организатор", 403);
    }

    if (sharedCart.orderedAt) {
      throw new ApiError("Эта общая корзина уже оформлена", 409);
    }

    if (sharedCart.items.length === 0) {
      throw new ApiError("Общая корзина пока пустая", 400);
    }
  }

  const orderInputItems = sharedCart
    ? aggregateSharedCartOrderItems(sharedCart.items)
    : data.items;
  const deliveryTimeSlot = await getDefaultDeliveryTimeSlot();
  const orderDeliveryDate = dateStringToDbDate(data.deliveryDate);
  const orderNumber = await createOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const inventoryReservations = await reserveDailyInventoryForLines(
      tx,
      data.deliveryDate,
      orderInputItems,
    );
    const built = await buildOrderItems(orderInputItems, {
      needsLift: data.needsLift,
      inventoryReservations,
    });
    assertSameDayOrderHasOnlyInventory(data.deliveryDate, built.itemRows);
    const courierAssignment = await getAutomaticCourierAssignment(
      tx,
      orderDeliveryDate,
      address,
    );

    const createdOrder = await tx.order.create({
      data: {
        orderNumber,
        userId,
        addressId: data.addressId,
        sharedCartId: sharedCart?.id,
        sharedCartTitle: sharedCart?.title,
        deliveryDate: orderDeliveryDate,
        deliveryTimeSlotId: deliveryTimeSlot.id,
        status: OrderStatus.ASSEMBLING,
        courierId: courierAssignment?.courierId,
        preliminaryTotal: built.preliminaryTotal,
        finalTotal: built.finalTotal,
        needsLift: data.needsLift,
        liftFee: built.liftFee,
        customerComment: data.customerComment || null,
        editableUntil: new Date(Date.now() + CUSTOMER_ORDER_EDIT_WINDOW_MS),
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
        sharedCart: true,
      },
    });

    if (courierAssignment) {
      await tx.deliveryTask.create({
        data: {
          orderId: createdOrder.id,
          courierId: courierAssignment.courierId,
          status: DeliveryTaskStatus.ASSIGNED,
          routeOrder: courierAssignment.routeOrder,
        },
      });
      await reorderCourierRoute(tx, courierAssignment.courierId, orderDeliveryDate);
    }

    if (sharedCart) {
      await tx.sharedCart.update({
        where: { id: sharedCart.id },
        data: { orderedAt: new Date() },
      });
    }

    return createdOrder;
  }, ORDER_TRANSACTION_OPTIONS);

  await applyCourierRedistribution(data.deliveryDate).catch((error) => {
    console.warn("Automatic courier redistribution failed after order creation", {
      orderId: order.id,
      message: error instanceof Error ? error.message : String(error),
    });
  });

  await createNotification({
    userId,
    orderId: order.id,
    type: NotificationType.ORDER_CREATED,
    title: "Заказ оформлен",
    message: sharedCart
      ? `Общий заказ ${order.orderNumber} принят в работу.`
      : `Заказ ${order.orderNumber} принят в работу.`,
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
    include: { items: true },
  });

  if (!existing) {
    throw new ApiError("Заказ не найден", 404);
  }

  if (!canCustomerEdit(existing)) {
    throw new ApiError("Самостоятельное редактирование уже недоступно", 403);
  }

  const existingDeliveryDate = format(existing.deliveryDate, "yyyy-MM-dd");
  if (data.deliveryDate !== existingDeliveryDate) {
    assertCustomerDeliveryDateAvailable(data.deliveryDate, {
      allowTodayAfterCutoff: true,
    });
  }

  const address = await prisma.address.findFirst({
    where: { id: data.addressId, userId, isDeleted: false },
  });

  if (!address) {
    throw new ApiError("Адрес не найден", 404);
  }

  const deliveryTimeSlot = await getDefaultDeliveryTimeSlot();

  const order = await prisma.$transaction(async (tx) => {
    await releaseDailyInventoryForLines(
      tx,
      getInventoryDateFromOrder(existing),
      orderToInventoryLines(existing),
    );
    const inventoryReservations = await reserveDailyInventoryForLines(
      tx,
      data.deliveryDate,
      data.items,
    );
    const built = await buildOrderItems(data.items, {
      needsLift: data.needsLift,
      inventoryReservations,
    });
    assertSameDayOrderHasOnlyInventory(data.deliveryDate, built.itemRows);

    await tx.orderItem.deleteMany({
      where: { orderId },
    });

    return tx.order.update({
      where: { id: orderId },
      data: {
        addressId: data.addressId,
        deliveryDate: dateStringToDbDate(data.deliveryDate),
        deliveryTimeSlotId: deliveryTimeSlot.id,
        customerComment: data.customerComment || null,
        preliminaryTotal: built.preliminaryTotal,
        finalTotal: built.finalTotal,
        needsLift: data.needsLift,
        liftFee: built.liftFee,
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
  }, ORDER_TRANSACTION_OPTIONS);

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
  assertCustomerDeliveryDateAvailable(data.deliveryDate, {
    allowTodayAfterCutoff: true,
  });
  const existing = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      address: true,
      items: true,
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

  const deliveryTimeSlot = await getDefaultDeliveryTimeSlot();

  const result = await prisma.$transaction(async (tx) => {
    await releaseDailyInventoryForLines(
      tx,
      getInventoryDateFromOrder(existing),
      orderToInventoryLines(existing),
    );
    const inventoryReservations = await reserveDailyInventoryForLines(
      tx,
      data.deliveryDate,
      orderToInventoryLines(existing),
    );
    assertSameDayOrderHasOnlyInventory(
      data.deliveryDate,
      existing.items.map((item) => ({
        isPreorder: Boolean(
          item.productId
            ? inventoryReservations.get(item.productId)?.isPreorder
            : true,
        ),
      })),
    );

    await Promise.all(
      existing.items.map((item) => {
        const inventoryReservation = item.productId
          ? inventoryReservations.get(item.productId)
          : null;

        return tx.orderItem.update({
          where: { id: item.id },
          data: {
            reservedQuantity: inventoryReservation?.reservedQuantity ?? 0,
            isPreorder: Boolean(inventoryReservation?.isPreorder),
          },
        });
      }),
    );

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        deliveryDate: dateStringToDbDate(data.deliveryDate),
        deliveryTimeSlotId: deliveryTimeSlot.id,
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

    const notification = await tx.notification.create({
      data: {
        userId,
        orderId,
        type: NotificationType.ORDER_UPDATED,
        title: "Дата доставки изменена",
        message: `По заказу ${updated.orderNumber} выбрана новая дата доставки ${data.deliveryDate}. Администратор подтвердит перенос.`,
      },
    });

    return { order: updated, notification };
  }, ORDER_TRANSACTION_OPTIONS);

  await sendPushForNotification(result.notification);

  return result.order;
}

export async function removeUnavailableOrderItemByCustomer(
  userId: string,
  orderId: string,
  input: unknown,
) {
  const data = replacementDecisionSchema.parse(input);
  const notification = await prisma.notification.findFirst({
    where: {
      id: data.notificationId,
      userId,
      orderId,
      type: NotificationType.REPLACEMENT_REQUIRED,
      isRead: false,
    },
  });

  if (!notification) {
    throw new ApiError("Уведомление уже обработано или не найдено", 404);
  }

  const unavailableProductName = getUnavailableProductName(notification);

  if (!unavailableProductName) {
    throw new ApiError("Не удалось определить отсутствующий товар", 400);
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId,
      status: {
        notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      },
    },
    include: {
      items: true,
    },
  });

  if (!order) {
    throw new ApiError("Заказ не найден или уже завершён", 404);
  }

  const unavailableItem = order.items.find(
    (item) => item.productName === unavailableProductName,
  );

  if (!unavailableItem) {
    throw new ApiError("Эта позиция уже отсутствует в заказе", 409);
  }

  const remainingItems = order.items.filter((item) => item.id !== unavailableItem.id);

  const result = await prisma.$transaction(async (tx) => {
    await releaseDailyInventoryForLines(tx, getInventoryDateFromOrder(order), [
      {
        productId: unavailableItem.productId,
        quantity: unavailableItem.orderedQuantity,
      },
    ]);

    if (remainingItems.length === 0) {
      const cancelled = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          preliminaryTotal: 0,
          finalTotal: 0,
        },
      });

      await tx.orderItem.delete({
        where: { id: unavailableItem.id },
      });

      await tx.notification.update({
        where: { id: notification.id },
        data: { isRead: true },
      });

      const pushNotification = await tx.notification.create({
        data: {
          userId,
          orderId,
          type: NotificationType.ORDER_CANCELLED,
          title: "Заказ отменён",
          message: `Позиция «${unavailableProductName}» была единственной в заказе, поэтому заказ ${cancelled.orderNumber} отменён.`,
        },
      });

      return {
        order: cancelled,
        productName: unavailableProductName,
        orderCancelled: true,
        pushNotification,
      };
    }

    const totals = getTotalsFromExistingItems(remainingItems, order.liftFee);

    await tx.orderItem.delete({
      where: { id: unavailableItem.id },
    });

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        preliminaryTotal: totals.preliminaryTotal,
        finalTotal: totals.finalTotal,
        status: OrderStatus.PENDING_CONFIRMATION,
      },
      include: {
        items: true,
        address: true,
        deliveryTimeSlot: true,
      },
    });

    await tx.notification.update({
      where: { id: notification.id },
      data: { isRead: true },
    });

    const pushNotification = await tx.notification.create({
      data: {
        userId,
        orderId,
        type: NotificationType.ORDER_UPDATED,
        title: "Позиция удалена из заказа",
        message: `Позиция «${unavailableProductName}» удалена из заказа ${updated.orderNumber}. Сумма заказа пересчитана.`,
      },
    });

    return {
      order: updated,
      productName: unavailableProductName,
      orderCancelled: false,
      pushNotification,
    };
  }, ORDER_TRANSACTION_OPTIONS);

  await sendPushForNotification(result.pushNotification);

  return {
    order: result.order,
    productName: result.productName,
    orderCancelled: result.orderCancelled,
  };
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

  const title = `Сейчас нет: ${productName}`;
  const existingNotifications = await prisma.notification.findMany({
    where: {
      type: NotificationType.REPLACEMENT_REQUIRED,
      orderId: {
        in: affectedOrders.map((order) => order.id),
      },
    },
    select: { orderId: true, title: true, message: true },
  });
  const alreadyNotifiedOrderIds = new Set(
    existingNotifications
      .filter(
        (notification) => getUnavailableProductName(notification) === productName,
      )
      .map((notification) => notification.orderId)
      .filter(Boolean) as string[],
  );
  const ordersToNotify = affectedOrders.filter(
    (order) => !alreadyNotifiedOrderIds.has(order.id),
  );
  const message = `К сожалению, позиции «${productName}» сегодня нет в хорошем качестве. Пожалуйста, пройдите в личный кабинет: вы можете убрать эту позицию из заказа или выбрать другую дату доставки.`;

  const pushNotifications = await prisma.$transaction(async (tx) => {
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
      return Promise.all(
        ordersToNotify.map((order) =>
          tx.notification.create({
            data: {
              userId: order.userId,
              orderId: order.id,
              type: NotificationType.REPLACEMENT_REQUIRED,
              title,
              message,
            },
          }),
        ),
      );
    }

    return [];
  }, ORDER_TRANSACTION_OPTIONS);

  await sendPushForNotifications(pushNotifications);

  return {
    productName,
    affectedOrders: affectedOrders.length,
    notifiedCustomers: new Set(ordersToNotify.map((order) => order.userId)).size,
  };
}

export async function cancelOrderByCustomer(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  });

  if (!order) {
    throw new ApiError("Заказ не найден", 404);
  }

  if (!canCustomerEdit(order)) {
    throw new ApiError("Отмена через кабинет уже недоступна", 403);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await releaseDailyInventoryForLines(
      tx,
      getInventoryDateFromOrder(order),
      orderToInventoryLines(order),
    );

    return tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
      },
    });
  }, ORDER_TRANSACTION_OPTIONS);

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
      ],
    };
  }

  if (filters.courierId === "unassigned") {
    where.courierId = null;
  } else if (filters.courierId) {
    where.courierId = filters.courierId;
  }

  if (filters.timeSlotId) {
    where.deliveryTimeSlotId = filters.timeSlotId;
  }

  return readWithPrismaRetry(() =>
    prisma.order.findMany({
      where,
      include: {
        user: true,
        address: true,
        sharedCart: true,
        items: true,
        courier: true,
        deliveryTimeSlot: true,
      },
      orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
    }),
  );
}

export async function getAdminOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      address: true,
      sharedCart: {
        include: {
          items: {
            include: {
              addedBy: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },
            },
            orderBy: [{ addedBy: { name: "asc" } }, { productName: "asc" }],
          },
        },
      },
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

export async function getPickerAssemblyOrders(filters: { date?: string | null } = {}) {
  const date = filters.date || format(new Date(), "yyyy-MM-dd");
  const assemblyStatuses: OrderStatus[] = [
    OrderStatus.NEW,
    OrderStatus.PENDING_CONFIRMATION,
    OrderStatus.CONFIRMED,
    OrderStatus.ASSEMBLING,
    OrderStatus.ASSEMBLED,
  ];

  return prisma.order.findMany({
    where: {
      deliveryDate: dateStringToDbDate(date),
      status: {
        in: assemblyStatuses,
      },
    },
    include: {
      user: true,
      address: true,
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
        orderBy: [{ productName: "asc" }],
      },
      deliveryTimeSlot: true,
      sharedCart: {
        include: {
          items: {
            include: {
              addedBy: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },
            },
            orderBy: [{ addedBy: { name: "asc" } }, { productName: "asc" }],
          },
        },
      },
    },
    orderBy: [{ deliveryTimeSlot: { startTime: "asc" } }, { createdAt: "asc" }],
  });
}

export async function updateOrderByAdmin(orderId: string, input: unknown) {
  const data = orderEditSchema.partial().parse(input);
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
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

  return prisma.$transaction(async (tx) => {
    const nextDeliveryDate = data.deliveryDate ?? getInventoryDateFromOrder(existing);

    if (data.deliveryDate && data.deliveryDate !== getInventoryDateFromOrder(existing)) {
      await releaseDailyInventoryForLines(
        tx,
        getInventoryDateFromOrder(existing),
        orderToInventoryLines(existing),
      );
      const inventoryReservations = await reserveDailyInventoryForLines(
        tx,
        nextDeliveryDate,
        orderToInventoryLines(existing),
      );

      await Promise.all(
        existing.items.map((item) => {
          const inventoryReservation = item.productId
            ? inventoryReservations.get(item.productId)
            : null;
          const reservedQuantity = inventoryReservation?.reservedQuantity ?? 0;

          return tx.orderItem.update({
            where: { id: item.id },
            data: {
              reservedQuantity,
              isPreorder: Boolean(inventoryReservation?.isPreorder),
            },
          });
        }),
      );
    }

    return tx.order.update({
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
  }, ORDER_TRANSACTION_OPTIONS);
}

export async function deleteOrderByAdmin(orderId: string) {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!existing) {
    throw new ApiError("Заказ не найден", 404);
  }

  await prisma.$transaction(async (tx) => {
    await undoDailyInventoryForLines(
      tx,
      getInventoryDateFromOrder(existing),
      orderToInventoryLines(existing),
      existing.status,
    );

    await tx.order.delete({
      where: { id: orderId },
    });
  }, ORDER_TRANSACTION_OPTIONS);

  return { ok: true };
}

export async function updateOrderStatusByAdmin(orderId: string, input: unknown) {
  const data = orderStatusSchema.parse(input);
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!existing) {
    throw new ApiError("Р—Р°РєР°Р· РЅРµ РЅР°Р№РґРµРЅ", 404);
  }

  const order = await prisma.$transaction(async (tx) => {
    if (
      data.status === OrderStatus.CANCELLED &&
      existing.status !== OrderStatus.CANCELLED &&
      existing.status !== OrderStatus.DELIVERED
    ) {
      await releaseDailyInventoryForLines(
        tx,
        getInventoryDateFromOrder(existing),
        orderToInventoryLines(existing),
      );
    }

    if (
      data.status === OrderStatus.DELIVERED &&
      existing.status !== OrderStatus.DELIVERED &&
      existing.status !== OrderStatus.CANCELLED
    ) {
      await completeDailyInventoryForLines(
        tx,
        getInventoryDateFromOrder(existing),
        orderToInventoryLines(existing),
      );
    }

    return tx.order.update({
      where: { id: orderId },
      data: {
        status: data.status,
        adminComment:
          data.adminComment === undefined ? undefined : data.adminComment || null,
      },
    });
  }, ORDER_TRANSACTION_OPTIONS);

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

export async function updateOrderStatusesByAdmin(input: unknown) {
  const data = bulkOrderStatusSchema.parse(input);
  const orderIds = [...new Set(data.orderIds)];

  const existingOrders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { items: true },
  });

  if (existingOrders.length !== orderIds.length) {
    throw new ApiError("Один или несколько заказов не найдены", 404);
  }

  const updatedOrders = await prisma.$transaction(async (tx) => {
    const updated: Order[] = [];

    for (const existing of existingOrders) {
      if (existing.status === data.status) {
        continue;
      }

      if (
        data.status === OrderStatus.CANCELLED &&
        existing.status !== OrderStatus.CANCELLED &&
        existing.status !== OrderStatus.DELIVERED
      ) {
        await releaseDailyInventoryForLines(
          tx,
          getInventoryDateFromOrder(existing),
          orderToInventoryLines(existing),
        );
      }

      if (
        data.status === OrderStatus.DELIVERED &&
        existing.status !== OrderStatus.DELIVERED &&
        existing.status !== OrderStatus.CANCELLED
      ) {
        await completeDailyInventoryForLines(
          tx,
          getInventoryDateFromOrder(existing),
          orderToInventoryLines(existing),
        );
      }

      updated.push(
        await tx.order.update({
          where: { id: existing.id },
          data: {
            status: data.status,
            adminComment:
              data.adminComment === undefined ? undefined : data.adminComment || null,
          },
        }),
      );
    }

    return updated;
  }, ORDER_TRANSACTION_OPTIONS);

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
    await Promise.all(
      updatedOrders.map((order) =>
        createNotification({
          userId: order.userId,
          orderId: order.id,
          type,
          title: orderStatusTitles[data.status] ?? "Статус обновлён",
          message: `Статус заказа ${order.orderNumber} изменён на "${
            orderStatusMeta[data.status]?.label ?? data.status
          }".`,
        }),
      ),
    );
  }

  return {
    count: updatedOrders.length,
    orders: updatedOrders,
  };
}

export async function updateOrderItemsByAdmin(orderId: string, input: unknown) {
  const data = orderItemsSchema.parse(input);
  const order = await getAdminOrder(orderId);

  return prisma.$transaction(async (tx) => {
    await undoDailyInventoryForLines(
      tx,
      getInventoryDateFromOrder(order),
      orderToInventoryLines(order),
      order.status,
    );

    let inventoryReservations: Map<string, InventoryReservation> | undefined;

    if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED) {
      inventoryReservations = await reserveDailyInventoryForLines(
        tx,
        getInventoryDateFromOrder(order),
        data.items,
      );
    }

    const built = await buildOrderItems(data.items, {
      needsLift: order.needsLift,
      inventoryReservations,
    });

    if (order.status === OrderStatus.DELIVERED) {
      await completeDailyInventoryForLines(
        tx,
        getInventoryDateFromOrder(order),
        built.itemRows.map((item) => ({
          productId: item.productId,
          quantity: item.orderedQuantity,
        })),
      );
    }

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
  }, ORDER_TRANSACTION_OPTIONS);
}

function printableNumber(value: number | string | { toString(): string } | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export async function updateOrderActualQuantitiesByStaff(orderId: string, input: unknown) {
  const data = orderActualItemsSchema.parse(input);
  const order = await getAdminOrder(orderId);
  const lockedStatuses: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELLED];

  if (lockedStatuses.includes(order.status)) {
    throw new ApiError("Завершённый заказ нельзя редактировать", 400);
  }

  const existingItems = new Map(order.items.map((item) => [item.id, item]));
  const requestedItems = new Map(data.items.map((item) => [item.id, item]));

  for (const itemId of requestedItems.keys()) {
    if (!existingItems.has(itemId)) {
      throw new ApiError("Позиция заказа не найдена", 404);
    }
  }

  const nextItems = order.items.map((item) => {
    const requested = requestedItems.get(item.id);
    const actualQuantity = requested
      ? requested.actualQuantity ?? null
      : item.actualQuantity;
    const effectiveQuantity = actualQuantity ?? item.orderedQuantity;
    const finalSum = printableNumber(item.price) * printableNumber(effectiveQuantity);

    return {
      id: item.id,
      actualQuantity,
      finalSum,
    };
  });
  const nextFinalTotal =
    nextItems.reduce((sum, item) => sum + item.finalSum, 0) + printableNumber(order.liftFee);

  return prisma.$transaction(async (tx) => {
    await Promise.all(
      nextItems.map((item) =>
        tx.orderItem.update({
          where: { id: item.id },
          data: {
            actualQuantity: item.actualQuantity,
            finalSum: item.finalSum,
          },
        }),
      ),
    );

    return tx.order.update({
      where: { id: orderId },
      data: {
        finalTotal: nextFinalTotal,
      },
      include: {
        items: true,
      },
    });
  }, ORDER_TRANSACTION_OPTIONS);
}

export async function assignCourierToOrder(
  orderId: string,
  input: unknown,
  options: { adminUserId?: string } = {},
) {
  const data = assignCourierSchema.parse(input);
  const order = await getAdminOrder(orderId);
  const previousCourierId = order.courierId;

  if (!data.courierId) {
    return prisma.$transaction(async (tx) => {
      await tx.deliveryTask.deleteMany({
        where: { orderId },
      });

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { courierId: null },
      });

      if (previousCourierId) {
        await reorderCourierRoute(tx, previousCourierId, order.deliveryDate);
      }

      return updatedOrder;
    }, ORDER_TRANSACTION_OPTIONS);
  }

  const courier = await prisma.user.findFirst({
    where: {
      id: data.courierId,
      OR: [
        {
          role: Role.COURIER,
          courierProfile: {
            is: {
              isActive: true,
            },
          },
        },
        {
          id: options.adminUserId ?? "__no_admin_self__",
          role: Role.ADMIN,
        },
      ],
    },
  });

  if (!courier) {
    throw new ApiError("Курьер не найден", 404);
  }

  return prisma.$transaction(async (tx) => {
    const routeOrder =
      (await tx.order.count({
        where: {
          id: { not: orderId },
          courierId: courier.id,
          deliveryDate: order.deliveryDate,
          status: {
            in: routeAssignableOrderStatuses,
          },
        },
      })) + 1;

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        courierId: courier.id,
        status:
          order.status === OrderStatus.ASSEMBLED
            ? OrderStatus.HANDED_TO_COURIER
            : order.status,
      },
    });

    await tx.deliveryTask.upsert({
      where: { orderId },
      update: {
        courierId: courier.id,
        status: DeliveryTaskStatus.ASSIGNED,
        routeOrder,
      },
      create: {
        orderId,
        courierId: courier.id,
        status: DeliveryTaskStatus.ASSIGNED,
        routeOrder,
      },
    });

    if (previousCourierId && previousCourierId !== courier.id) {
      await reorderCourierRoute(tx, previousCourierId, order.deliveryDate);
    }

    await reorderCourierRoute(tx, courier.id, order.deliveryDate);

    return updatedOrder;
  }, ORDER_TRANSACTION_OPTIONS);
}

type DistributionOrder = Prisma.OrderGetPayload<{
  include: {
    user: true;
    courier: true;
    address: true;
    deliveryTask: {
      select: {
        routeOrder: true;
      };
    };
  };
}>;

type RouteDistributionAssignment = {
  orderId: string;
  courierId: string;
  routeOrder: number;
};

function getDistributionAddressLabel(order: DistributionOrder) {
  return `${order.address.city}, ${order.address.street}, ${order.address.house}${
    order.address.apartment ? `, кв. ${order.address.apartment}` : ""
  }`;
}

type RouteState<TOrder extends { address: AddressWithCoordinates }> = {
  courierId: string;
  courierName: string;
  orders: TOrder[];
};

function chooseNearestRouteForOrders<TOrder extends { address: AddressWithCoordinates }>(
  orders: TOrder[],
  routes: Array<RouteState<TOrder>>,
) {
  return routes
    .map((route) => ({
      route,
      score: orders.reduce(
        (sum, order) => sum + scoreCourierForAddress(order.address, route.orders),
        0,
      ),
    }))
    .toSorted((first, second) => {
      const scoreDiff = first.score - second.score;
      const loadDiff = first.route.orders.length - second.route.orders.length;

      return (
        scoreDiff ||
        loadDiff ||
        first.route.courierName.localeCompare(second.route.courierName, "ru")
      );
    })[0]?.route;
}

function chooseMainRouteForTinyOrders<TOrder extends { address: AddressWithCoordinates }>(
  orders: TOrder[],
  routes: Array<RouteState<TOrder>>,
) {
  return routes
    .map((route) => ({
      route,
      score:
        orders.reduce(
          (sum, order) => sum + scoreCourierForAddress(order.address, route.orders),
          0,
        ) -
        route.orders.length * COURIER_MAIN_ROUTE_MERGE_BONUS,
    }))
    .toSorted((first, second) => {
      const scoreDiff = first.score - second.score;
      const mainRouteDiff = second.route.orders.length - first.route.orders.length;

      return (
        scoreDiff ||
        mainRouteDiff ||
        first.route.courierName.localeCompare(second.route.courierName, "ru")
      );
    })[0]?.route;
}

function mergeTinyCourierRoutes<TOrder extends { address: AddressWithCoordinates }>(
  routeStates: Array<RouteState<TOrder>>,
) {
  while (routeStates.filter((route) => route.orders.length > 0).length > 1) {
    const tinyRoute = routeStates
      .filter(
        (route) =>
          route.orders.length > 0 &&
          route.orders.length < MIN_COURIER_ROUTE_ORDERS,
      )
      .toSorted((first, second) => first.orders.length - second.orders.length)[0];

    if (!tinyRoute) {
      break;
    }

    const targetRoute = chooseMainRouteForTinyOrders(
      tinyRoute.orders,
      routeStates.filter((route) => route !== tinyRoute && route.orders.length > 0),
    );

    if (!targetRoute) {
      break;
    }

    targetRoute.orders.push(...tinyRoute.orders);
    tinyRoute.orders = [];
  }
}

function buildRouteDistributionPlan(
  deliveryDate: string,
  orders: DistributionOrder[],
  couriers: Array<{ userId: string; name: string; user: { name: string } }>,
) {
  const sortedCouriers = couriers.toSorted((first, second) =>
    (first.name || first.user.name).localeCompare(
      second.name || second.user.name,
      "ru",
    ),
  );
  const routeStates = sortedCouriers.map((courier) => ({
    courierId: courier.userId,
    courierName: courier.name || courier.user.name,
    orders: [] as DistributionOrder[],
  }));

  if (routeStates.length === 0) {
    return {
      date: deliveryDate,
      changes: [],
      routes: [],
      unassignedCount: orders.filter((order) => !order.courierId).length,
    };
  }

  const activeRouteStates = routeStates;
  const orderedQueue = [...orders].sort((first, second) => {
    const firstRouteOrder = first.deliveryTask?.routeOrder ?? Number.MAX_SAFE_INTEGER;
    const secondRouteOrder = second.deliveryTask?.routeOrder ?? Number.MAX_SAFE_INTEGER;

    return (
      firstRouteOrder - secondRouteOrder ||
      first.createdAt.getTime() - second.createdAt.getTime()
    );
  });

  for (const order of orderedQueue) {
    const sectorIndex = getAddressSectorIndex(order.address, activeRouteStates.length);
    const sectorRoute =
      sectorIndex === null ? null : activeRouteStates[sectorIndex] ?? null;
    const fallbackRoute = chooseNearestRouteForOrders([order], activeRouteStates);
    const route = sectorRoute ?? fallbackRoute;

    route?.orders.push(order);
  }

  mergeTinyCourierRoutes(routeStates);

  const routes = routeStates.map((route) => {
    const routeOrders = sortRouteItemsByDistance(route.orders);
    const routeDistance = getRouteDistanceForItems(routeOrders);

    return {
      courierId: route.courierId,
      courierName: route.courierName,
      ordersCount: routeOrders.length,
      distanceKm: routeDistance.distanceKm,
      knownSegments: routeDistance.knownSegments,
      etaMinutes: getRouteEtaMinutes(routeDistance.distanceKm, routeOrders.length),
      orders: routeOrders.map((order, index) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.user.name,
        address: getDistributionAddressLabel(order),
        routeOrder: index + 1,
        currentCourierId: order.courierId,
        currentCourierName: order.courier?.name ?? null,
      })),
    };
  });

  const changes = routes.flatMap((route) =>
    route.orders
      .filter((order) => order.currentCourierId !== route.courierId)
      .map((order) => ({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        address: order.address,
        currentCourierId: order.currentCourierId,
        currentCourierName: order.currentCourierName,
        suggestedCourierId: route.courierId,
        suggestedCourierName: route.courierName,
        routeOrder: order.routeOrder,
      })),
  );

  return {
    date: deliveryDate,
    changes,
    routes,
    unassignedCount: routes.flatMap((route) => route.orders).filter(
      (order) => !order.currentCourierId,
    ).length,
  };
}

export async function previewCourierRedistribution(deliveryDate: string) {
  const date = dateStringToDbDate(deliveryDate);
  const [orders, couriers] = await Promise.all([
    prisma.order.findMany({
      where: {
        deliveryDate: date,
        status: {
          in: routeAssignableOrderStatuses,
        },
      },
      include: {
        user: true,
        courier: true,
        address: true,
        deliveryTask: {
          select: {
            routeOrder: true,
          },
        },
      },
      orderBy: [{ deliveryTimeSlot: { startTime: "asc" } }, { createdAt: "asc" }],
    }),
    prisma.courier.findMany({
      where: {
        isActive: true,
        user: {
          role: Role.COURIER,
        },
      },
      select: {
        userId: true,
        name: true,
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  return buildRouteDistributionPlan(deliveryDate, orders, couriers);
}

async function applyManualCourierRedistribution(
  deliveryDate: string,
  assignments: RouteDistributionAssignment[],
) {
  const date = dateStringToDbDate(deliveryDate);
  const normalizedAssignments = assignments
    .filter((assignment) => assignment.orderId && assignment.courierId)
    .map((assignment, index) => ({
      ...assignment,
      routeOrder:
        Number.isInteger(assignment.routeOrder) && assignment.routeOrder > 0
          ? assignment.routeOrder
          : index + 1,
    }));
  const orderIds = [...new Set(normalizedAssignments.map((assignment) => assignment.orderId))];
  const courierIds = [...new Set(normalizedAssignments.map((assignment) => assignment.courierId))];

  if (orderIds.length === 0) {
    throw new ApiError("Нет заказов для сохранения маршрута", 400);
  }

  const [orders, couriers] = await Promise.all([
    prisma.order.findMany({
      where: {
        id: { in: orderIds },
        deliveryDate: date,
        status: {
          in: routeAssignableOrderStatuses,
        },
      },
      select: { id: true },
    }),
    prisma.courier.findMany({
      where: {
        userId: { in: courierIds },
        isActive: true,
        user: {
          role: Role.COURIER,
        },
      },
      select: { userId: true },
    }),
  ]);
  const allowedOrderIds = new Set(orders.map((order) => order.id));
  const allowedCourierIds = new Set(couriers.map((courier) => courier.userId));

  if (allowedOrderIds.size !== orderIds.length) {
    throw new ApiError("В маршруте есть заказ не из выбранной даты", 400);
  }

  if (allowedCourierIds.size !== courierIds.length) {
    throw new ApiError("В маршруте есть неактивный курьер", 400);
  }

  await prisma.$transaction(async (tx) => {
    for (const assignment of normalizedAssignments) {
      await tx.order.update({
        where: { id: assignment.orderId },
        data: { courierId: assignment.courierId },
      });

      await tx.deliveryTask.upsert({
        where: { orderId: assignment.orderId },
        update: {
          courierId: assignment.courierId,
          status: DeliveryTaskStatus.ASSIGNED,
          routeOrder: assignment.routeOrder,
        },
        create: {
          orderId: assignment.orderId,
          courierId: assignment.courierId,
          status: DeliveryTaskStatus.ASSIGNED,
          routeOrder: assignment.routeOrder,
        },
      });
    }
  }, ORDER_TRANSACTION_OPTIONS);

  return previewCourierRedistribution(deliveryDate);
}

export async function applyCourierRedistribution(
  deliveryDate: string,
  assignments?: RouteDistributionAssignment[],
) {
  if (assignments && assignments.length > 0) {
    return applyManualCourierRedistribution(deliveryDate, assignments);
  }

  const proposal = await previewCourierRedistribution(deliveryDate);

  await prisma.$transaction(async (tx) => {
    for (const route of proposal.routes) {
      for (const order of route.orders) {
        await tx.order.update({
          where: { id: order.orderId },
          data: { courierId: route.courierId },
        });

        await tx.deliveryTask.upsert({
          where: { orderId: order.orderId },
          update: {
            courierId: route.courierId,
            status: DeliveryTaskStatus.ASSIGNED,
            routeOrder: order.routeOrder,
          },
          create: {
            orderId: order.orderId,
            courierId: route.courierId,
            status: DeliveryTaskStatus.ASSIGNED,
            routeOrder: order.routeOrder,
          },
        });
      }
    }
  }, ORDER_TRANSACTION_OPTIONS);

  return previewCourierRedistribution(deliveryDate);
}

export async function getUnassignedOrdersCount(date?: string | null) {
  return prisma.order.count({
    where: {
      deliveryDate: date ? dateStringToDbDate(date) : undefined,
      courierId: null,
      status: {
        in: routeAssignableOrderStatuses,
      },
    },
  });
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
        in: routeAssignableOrderStatuses,
      },
    },
    include: {
      user: true,
      courier: true,
      address: true,
      sharedCart: true,
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
        in: [...labelPrintableOrderStatuses] as OrderStatus[],
      },
    },
    include: {
      user: true,
      address: true,
      deliveryTimeSlot: true,
      sharedCart: {
        include: {
          items: {
            include: {
              addedBy: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },
            },
            orderBy: [{ addedBy: { name: "asc" } }, { productName: "asc" }],
          },
        },
      },
    },
    orderBy: [{ deliveryTimeSlot: { startTime: "asc" } }, { createdAt: "asc" }],
  });
}

export async function getOrdersForStaffPdf(filters: {
  date?: string;
  beforeDate?: string | null;
  courierId?: string | null;
  statuses?: OrderStatus[] | null;
}) {
  const deliveryDate = filters.beforeDate
    ? { lt: dateStringToDbDate(filters.beforeDate) }
    : dateStringToDbDate(filters.date ?? format(new Date(), "yyyy-MM-dd"));
  const status = filters.statuses?.length
    ? { in: filters.statuses }
    : { not: OrderStatus.CANCELLED };

  return prisma.order.findMany({
    where: {
      deliveryDate,
      courierId: filters.courierId || undefined,
      status,
    },
    include: {
      user: true,
      address: true,
      items: true,
      courier: true,
      deliveryTimeSlot: true,
      deliveryTask: true,
      sharedCart: {
        include: {
          items: {
            include: {
              addedBy: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },
            },
            orderBy: [{ addedBy: { name: "asc" } }, { productName: "asc" }],
          },
        },
      },
    },
    orderBy: [
      { deliveryDate: "asc" },
      { deliveryTimeSlot: { startTime: "asc" } },
      { createdAt: "asc" },
    ],
  });
}

export type ProcurementPdfItem = {
  productName: string;
  categoryName: string;
  unit: string;
  orderedQuantity: number;
  reservedQuantity: number;
  toBuyQuantity: number;
  ordersCount: number;
};

function decimalToNumber(value: number | string | { toString(): string }) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
}

export async function getProcurementItemsForPdf(filters: { date: string }) {
  const orders = await prisma.order.findMany({
    where: {
      deliveryDate: dateStringToDbDate(filters.date),
      status: {
        not: OrderStatus.CANCELLED,
      },
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      },
    },
    orderBy: [{ deliveryTimeSlot: { startTime: "asc" } }, { createdAt: "asc" }],
  });

  const groupedItems = new Map<
    string,
    {
      productName: string;
      categoryName: string;
      unit: string;
      orderedQuantity: number;
      reservedQuantity: number;
      toBuyQuantity: number;
      orderIds: Set<string>;
    }
  >();

  for (const order of orders) {
    for (const item of order.items) {
      const orderedQuantity = decimalToNumber(item.orderedQuantity);
      const reservedQuantity = Math.min(
        orderedQuantity,
        Math.max(0, decimalToNumber(item.reservedQuantity)),
      );
      const toBuyQuantity = Math.max(orderedQuantity - reservedQuantity, 0);
      const productName = item.product?.name ?? item.productName;
      const categoryName = item.product?.category?.name ?? "Без категории";
      const key = item.productId ?? `${productName}:${item.unit}`;
      const current =
        groupedItems.get(key) ??
        {
          productName,
          categoryName,
          unit: item.unit,
          orderedQuantity: 0,
          reservedQuantity: 0,
          toBuyQuantity: 0,
          orderIds: new Set<string>(),
        };

      current.orderedQuantity += orderedQuantity;
      current.reservedQuantity += reservedQuantity;
      current.toBuyQuantity += toBuyQuantity;
      current.orderIds.add(order.id);
      groupedItems.set(key, current);
    }
  }

  const items = Array.from(groupedItems.values())
    .map((item) => ({
      productName: item.productName,
      categoryName: item.categoryName,
      unit: item.unit,
      orderedQuantity: item.orderedQuantity,
      reservedQuantity: item.reservedQuantity,
      toBuyQuantity: item.toBuyQuantity,
      ordersCount: item.orderIds.size,
    }))
    .toSorted(
      (first, second) =>
        first.categoryName.localeCompare(second.categoryName, "ru") ||
        first.productName.localeCompare(second.productName, "ru"),
    );

  return {
    ordersCount: orders.length,
    items,
  };
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
      { address: { city: { contains: normalizedQuery, mode: "insensitive" } } },
      { address: { street: { contains: normalizedQuery, mode: "insensitive" } } },
      { address: { house: { contains: normalizedQuery, mode: "insensitive" } } },
      { address: { apartment: { contains: normalizedQuery, mode: "insensitive" } } },
    ],
  };
}

export async function getCourierActiveTasks(
  userId: string,
  filters: { date?: string | null; beforeDate?: string | null } = {},
) {
  const deliveryDate = filters.beforeDate
    ? { lt: dateStringToDbDate(filters.beforeDate) }
    : filters.date
      ? dateStringToDbDate(filters.date)
      : undefined;

  return prisma.deliveryTask.findMany({
    where: {
      courierId: userId,
      status: {
        in: activeCourierTaskStatuses,
      },
      order: {
        is: {
          deliveryDate,
          status: {
            in: [
              OrderStatus.HANDED_TO_COURIER,
              OrderStatus.COURIER_ON_THE_WAY,
              OrderStatus.DELIVERY_ISSUE,
            ],
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

  if (data.status === DeliveryTaskStatus.IN_PROGRESS) {
    return startCourierRouteWithEta(taskId, courierUserId);
  }

  const task = await prisma.deliveryTask.findFirst({
    where: {
      id: taskId,
      courierId: courierUserId,
    },
    include: {
      order: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!task) {
    throw new ApiError("Задание курьера не найдено", 404);
  }

  const nextOrderStatus =
    data.status === DeliveryTaskStatus.DELIVERED
      ? OrderStatus.DELIVERED
      : task.order.status;

  return prisma.$transaction(async (tx) => {
    await tx.deliveryTask.update({
      where: { id: taskId },
      data: {
        status: data.status,
        deliveredAt:
          data.status === DeliveryTaskStatus.DELIVERED ? new Date() : undefined,
      },
    });

    if (
      data.status === DeliveryTaskStatus.DELIVERED &&
      task.order.status !== OrderStatus.DELIVERED
    ) {
      await completeDailyInventoryForLines(
        tx,
        getInventoryDateFromOrder(task.order),
        orderToInventoryLines(task.order),
      );
    }

    return tx.order.update({
      where: { id: task.order.id },
      data: {
        status: nextOrderStatus,
      },
    });
  }, ORDER_TRANSACTION_OPTIONS);
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
