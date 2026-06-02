import { getDefaultDeliveryDate } from "@/lib/delivery-rules";
import { prisma } from "@/lib/db";
import { dateStringToDbDate } from "@/lib/utils";
import { OrderStatus, Prisma } from "@/generated/prisma";

export type InventoryLine = {
  productId?: string | null;
  quantity: number | string | { toString(): string };
};

export type InventoryReservation = {
  productId: string;
  requestedQuantity: number;
  reservedQuantity: number;
  isPreorder: boolean;
};

type InventoryClient = Prisma.TransactionClient | typeof prisma;

export function normalizeInventoryDate(date?: string | null) {
  const normalized = date?.trim().slice(0, 10);

  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? normalized
    : getDefaultDeliveryDate();
}

export function getInventoryAvailableQuantity(row: {
  quantityStart: number | string | { toString(): string };
  quantityReserved: number | string | { toString(): string };
  quantitySold: number | string | { toString(): string };
}) {
  return Math.max(
    0,
    Number(row.quantityStart) - Number(row.quantityReserved) - Number(row.quantitySold),
  );
}

function getOrderDateKey(date: Date | string) {
  if (typeof date === "string") {
    return date.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function aggregateLines(lines: InventoryLine[]) {
  const quantities = new Map<string, number>();

  for (const line of lines) {
    if (!line.productId) {
      continue;
    }

    const quantity = Number(line.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + quantity);
  }

  return quantities;
}

async function getTrackedInventoryRows(
  client: InventoryClient,
  date: string,
  productIds: string[],
) {
  if (productIds.length === 0) {
    return new Map<string, Awaited<ReturnType<typeof client.dailyInventory.findMany>>[number]>();
  }

  const rows = await client.dailyInventory.findMany({
    where: {
      date: dateStringToDbDate(date),
      productId: { in: productIds },
    },
  });

  return new Map(rows.map((row) => [row.productId, row]));
}

export async function getDailyInventoryBoard(dateInput?: string | null) {
  const date = normalizeInventoryDate(dateInput);
  const products = await prisma.product.findMany({
    include: {
      category: true,
      dailyInventories: {
        where: { date: dateStringToDbDate(date) },
        take: 1,
      },
    },
    orderBy: [
      { isActive: "desc" },
      { category: { sortOrder: "asc" } },
      { name: "asc" },
    ],
  });

  return {
    date,
    products: products.map((product) => {
      const inventory = product.dailyInventories[0] ?? null;

      return {
        ...product,
        dailyInventories: undefined,
        inventory: inventory
          ? {
              id: inventory.id,
              quantityStart: Number(inventory.quantityStart),
              quantityReserved: Number(inventory.quantityReserved),
              quantitySold: Number(inventory.quantitySold),
              availableQuantity: getInventoryAvailableQuantity(inventory),
              isTracked: true,
            }
          : {
              id: null,
              quantityStart: 0,
              quantityReserved: 0,
              quantitySold: 0,
              availableQuantity: null,
              isTracked: false,
            },
      };
    }),
  };
}

export async function updateDailyInventoryBoard(input: {
  date: string;
  items: Array<{ productId: string; quantityStart: number }>;
}) {
  const date = normalizeInventoryDate(input.date);
  const dbDate = dateStringToDbDate(date);

  await prisma.$transaction(
    input.items.map((item) =>
      prisma.dailyInventory.upsert({
        where: {
          productId_date: {
            productId: item.productId,
            date: dbDate,
          },
        },
        update: {
          quantityStart: item.quantityStart,
        },
        create: {
          productId: item.productId,
          date: dbDate,
          quantityStart: item.quantityStart,
        },
      }),
    ),
  );

  return getDailyInventoryBoard(date);
}

export async function addDailyAvailabilityToProducts<
  T extends {
    id: string;
  },
>(products: T[], dateInput?: string | null) {
  const date = normalizeInventoryDate(dateInput);
  const productIds = products.map((product) => product.id);
  const inventoryByProductId = await getTrackedInventoryRows(prisma, date, productIds);

  return products.map((product) => {
    const inventory = inventoryByProductId.get(product.id) ?? null;
    const availableQuantity = inventory
      ? getInventoryAvailableQuantity(inventory)
      : null;
    const isAvailableForDate = Boolean(inventory && (availableQuantity ?? 0) > 0);

    return {
      ...product,
      dailyInventoryDate: date,
      hasDailyInventory: Boolean(inventory),
      availableQuantity,
      isAvailableForDate,
    };
  });
}

export async function reserveDailyInventoryForLines(
  client: InventoryClient,
  dateInput: string,
  lines: InventoryLine[],
) {
  const date = normalizeInventoryDate(dateInput);
  const quantities = aggregateLines(lines);
  const inventoryByProductId = await getTrackedInventoryRows(
    client,
    date,
    [...quantities.keys()],
  );

  const reservations = new Map<string, InventoryReservation>();

  for (const [productId, quantity] of quantities) {
    const row = inventoryByProductId.get(productId);

    if (!row) {
      reservations.set(productId, {
        productId,
        requestedQuantity: quantity,
        reservedQuantity: 0,
        isPreorder: true,
      });
      continue;
    }

    const availableQuantity = getInventoryAvailableQuantity(row);
    const quantityToReserve = Math.min(quantity, availableQuantity);

    if (quantityToReserve <= 0) {
      reservations.set(productId, {
        productId,
        requestedQuantity: quantity,
        reservedQuantity: 0,
        isPreorder: true,
      });
      continue;
    }

    const updatedRows = await client.$executeRaw`
      UPDATE "DailyInventory"
      SET "quantityReserved" = "quantityReserved" + ${quantityToReserve},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${row.id}
        AND ("quantityStart" - "quantityReserved" - "quantitySold") >= ${quantityToReserve}
    `;

    reservations.set(productId, {
      productId,
      requestedQuantity: quantity,
      reservedQuantity: updatedRows === 0 ? 0 : quantityToReserve,
      isPreorder: updatedRows === 0 || quantityToReserve < quantity,
    });
  }

  return reservations;
}

export async function releaseDailyInventoryForLines(
  client: InventoryClient,
  dateInput: string,
  lines: InventoryLine[],
) {
  const date = normalizeInventoryDate(dateInput);
  const dbDate = dateStringToDbDate(date);
  const quantities = aggregateLines(lines);

  for (const [productId, quantity] of quantities) {
    await client.$executeRaw`
      UPDATE "DailyInventory"
      SET "quantityReserved" = GREATEST("quantityReserved" - ${quantity}, 0),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "productId" = ${productId}
        AND "date" = ${dbDate}
    `;
  }
}

export async function completeDailyInventoryForLines(
  client: InventoryClient,
  dateInput: string,
  lines: InventoryLine[],
) {
  const date = normalizeInventoryDate(dateInput);
  const dbDate = dateStringToDbDate(date);
  const quantities = aggregateLines(lines);

  for (const [productId, quantity] of quantities) {
    await client.$executeRaw`
      UPDATE "DailyInventory"
      SET "quantityReserved" = GREATEST("quantityReserved" - ${quantity}, 0),
          "quantitySold" = "quantitySold" + ${quantity},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "productId" = ${productId}
        AND "date" = ${dbDate}
    `;
  }
}

export async function undoDailyInventoryForLines(
  client: InventoryClient,
  dateInput: string,
  lines: InventoryLine[],
  status: OrderStatus,
) {
  const date = normalizeInventoryDate(dateInput);
  const dbDate = dateStringToDbDate(date);
  const quantities = aggregateLines(lines);
  const field = status === OrderStatus.DELIVERED ? "quantitySold" : "quantityReserved";

  if (status === OrderStatus.CANCELLED) {
    return;
  }

  for (const [productId, quantity] of quantities) {
    if (field === "quantitySold") {
      await client.$executeRaw`
        UPDATE "DailyInventory"
        SET "quantitySold" = GREATEST("quantitySold" - ${quantity}, 0),
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "productId" = ${productId}
          AND "date" = ${dbDate}
      `;
      continue;
    }

    await client.$executeRaw`
      UPDATE "DailyInventory"
      SET "quantityReserved" = GREATEST("quantityReserved" - ${quantity}, 0),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "productId" = ${productId}
        AND "date" = ${dbDate}
    `;
  }
}

export function orderToInventoryLines(order: {
  items: Array<{
    productId?: string | null;
    orderedQuantity: number | string | { toString(): string };
    reservedQuantity?: number | string | { toString(): string };
  }>;
}) {
  return order.items.map((item) => ({
    productId: item.productId,
    quantity: item.reservedQuantity ?? item.orderedQuantity,
  }));
}

export function getInventoryDateFromOrder(order: { deliveryDate: Date | string }) {
  return getOrderDateKey(order.deliveryDate);
}
