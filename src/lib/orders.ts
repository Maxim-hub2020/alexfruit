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
import {
  DELIVERY_FEE,
  labelPrintableOrderStatuses,
  orderStatusMeta,
} from "@/lib/constants";
import { prisma, readWithPrismaRetry } from "@/lib/db";
import {
  DEFAULT_DELIVERY_SLOT_CAPACITY,
  DEFAULT_DELIVERY_SLOT_END,
  DEFAULT_DELIVERY_SLOT_START,
  DEFAULT_DELIVERY_SLOT_TITLE,
  LIFT_SERVICE_FEE,
  getDeliveryDateAvailability,
} from "@/lib/delivery-rules";
import {
  sendPushForNotification,
  sendPushForNotifications,
} from "@/lib/push-notifications";
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
export const CUSTOMER_ORDER_EDIT_WINDOW_HOURS = 3;
const CUSTOMER_ORDER_EDIT_WINDOW_MS =
  CUSTOMER_ORDER_EDIT_WINDOW_HOURS * 60 * 60 * 1000;
export const customerEditableOrderStatuses: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.PENDING_CONFIRMATION,
  OrderStatus.CONFIRMED,
  OrderStatus.ASSEMBLING,
];
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

function assertCustomerDeliveryDateAvailable(deliveryDate: string) {
  const availability = getDeliveryDateAvailability(deliveryDate);

  if (!availability.available) {
    throw new ApiError(availability.reason ?? "Выберите другую дату доставки", 400);
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
  options: { needsLift?: boolean } = {},
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

export async function getStorefrontData(userId?: string) {
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
  const highlights = {
    popular: products.filter((product) => product.isHit).slice(0, 6),
    seasonal: products.filter((product) => product.isNew).slice(0, 6),
    promo: products.filter((product) => product.isPromo).slice(0, 6),
  };

  return {
    categories,
    products,
    timeSlots,
    highlights,
    collections: await buildStorefrontCollections(userId, products, highlights),
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
      items: true,
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
  assertCustomerDeliveryDateAvailable(data.deliveryDate);
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
  const built = await buildOrderItems(orderInputItems, {
    needsLift: data.needsLift,
  });

  const order = await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: {
        orderNumber: await createOrderNumber(),
        userId,
        addressId: data.addressId,
        sharedCartId: sharedCart?.id,
        sharedCartTitle: sharedCart?.title,
        deliveryDate: dateStringToDbDate(data.deliveryDate),
        deliveryTimeSlotId: deliveryTimeSlot.id,
        status: OrderStatus.NEW,
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

    if (sharedCart) {
      await tx.sharedCart.update({
        where: { id: sharedCart.id },
        data: { orderedAt: new Date() },
      });
    }

    return createdOrder;
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
  });

  if (!existing) {
    throw new ApiError("Заказ не найден", 404);
  }

  if (!canCustomerEdit(existing)) {
    throw new ApiError("Самостоятельное редактирование уже недоступно", 403);
  }

  const existingDeliveryDate = format(existing.deliveryDate, "yyyy-MM-dd");
  if (data.deliveryDate !== existingDeliveryDate) {
    assertCustomerDeliveryDateAvailable(data.deliveryDate);
  }

  const address = await prisma.address.findFirst({
    where: { id: data.addressId, userId, isDeleted: false },
  });

  if (!address) {
    throw new ApiError("Адрес не найден", 404);
  }

  const deliveryTimeSlot = await getDefaultDeliveryTimeSlot();
  const built = await buildOrderItems(data.items, {
    needsLift: data.needsLift,
  });

  const order = await prisma.$transaction(async (tx) => {
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
  assertCustomerDeliveryDateAvailable(data.deliveryDate);
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

  const deliveryTimeSlot = await getDefaultDeliveryTimeSlot();

  const result = await prisma.$transaction(async (tx) => {
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
  });

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
  });

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
  });

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
      sharedCart: true,
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

export async function deleteOrderByAdmin(orderId: string) {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError("Заказ не найден", 404);
  }

  await prisma.order.delete({
    where: { id: orderId },
  });

  return { ok: true };
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
  const order = await getAdminOrder(orderId);
  const built = await buildOrderItems(data.items, {
    needsLift: order.needsLift,
  });

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
