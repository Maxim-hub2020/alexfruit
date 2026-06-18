import bcrypt from "bcryptjs";
import { format } from "date-fns";
import { DeliveryTaskStatus, OrderStatus, Prisma, Role } from "@/generated/prisma";
import { ApiError } from "@/lib/api";
import { normalizeRussianPhone } from "@/lib/auth";
import { orderStatusMeta } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { applyCourierRedistribution } from "@/lib/orders";
import { adminCourierSchema, adminPickerSchema } from "@/lib/validators";

const activeOrderStatuses: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.PENDING_CONFIRMATION,
  OrderStatus.CONFIRMED,
  OrderStatus.ASSEMBLING,
  OrderStatus.ASSEMBLED,
  OrderStatus.HANDED_TO_COURIER,
  OrderStatus.COURIER_ON_THE_WAY,
  OrderStatus.DELIVERY_ISSUE,
];

const activeTaskStatuses: DeliveryTaskStatus[] = [
  DeliveryTaskStatus.ASSIGNED,
  DeliveryTaskStatus.IN_PROGRESS,
  DeliveryTaskStatus.ISSUE,
];

function toMoney(value: number | string | { toString(): string } | null | undefined) {
  return Number(value ?? 0);
}

function orderAmount(order: {
  preliminaryTotal: number | string | { toString(): string };
  finalTotal?: number | string | { toString(): string } | null;
}) {
  return toMoney(order.finalTotal ?? order.preliminaryTotal);
}

async function deleteStaffUser(tx: Prisma.TransactionClient, user: { id: string; phone?: string | null }) {
  await tx.messengerAuthChallenge.deleteMany({
    where: {
      OR: [{ userId: user.id }, ...(user.phone ? [{ phone: user.phone }] : [])],
    },
  });

  await tx.user.delete({
    where: { id: user.id },
  });
}

function buildDeliveryHistorySearch(query?: string | null): Prisma.OrderWhereInput | undefined {
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

function getDateFilterRange(date: string) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);

  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

function getLastDateKeys(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return format(date, "yyyy-MM-dd");
  });
}

export async function createCourier(input: unknown) {
  const data = adminCourierSchema.parse(input);
  const phone = normalizeRussianPhone(data.phone);

  if (!/^\+7\d{10}$/.test(phone)) {
    throw new ApiError("Укажите телефон курьера в формате +7XXXXXXXXXX", 400);
  }

  const existingUser = await prisma.user.findFirst({
    where: { phone },
  });

  if (existingUser) {
    throw new ApiError("Пользователь с таким телефоном уже существует", 409);
  }

  return prisma.user.create({
    data: {
      name: data.name,
      email: null,
      phone,
      passwordHash: await bcrypt.hash(data.password, 10),
      role: Role.COURIER,
      courierProfile: {
        create: {
          name: data.name,
          phone,
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
      courierProfile: {
        select: {
          id: true,
          name: true,
          phone: true,
          isActive: true,
        },
      },
    },
  });
}

export async function createPicker(input: unknown) {
  const data = adminPickerSchema.parse(input);
  const phone = normalizeRussianPhone(data.phone);

  if (!/^\+7\d{10}$/.test(phone)) {
    throw new ApiError("Укажите телефон сборщика в формате +7XXXXXXXXXX", 400);
  }

  const existingUser = await prisma.user.findFirst({
    where: { phone },
  });

  if (existingUser) {
    throw new ApiError("Пользователь с таким телефоном уже существует", 409);
  }

  return prisma.user.create({
    data: {
      name: data.name,
      email: null,
      phone,
      passwordHash: await bcrypt.hash(data.password, 10),
      role: Role.PICKER,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });
}

export async function removePickerFromSystem(userId: string) {
  const picker = await prisma.user.findFirst({
    where: {
      id: userId,
      role: Role.PICKER,
    },
  });

  if (!picker) {
    throw new ApiError("Сборщик не найден", 404);
  }

  await prisma.$transaction((tx) => deleteStaffUser(tx, picker));

  return { ok: true };
}

export async function removeCourierFromSystem(userId: string) {
  const courier = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      courierProfile: true,
    },
  });

  if (!courier || (!courier.courierProfile && courier.role !== Role.COURIER)) {
    throw new ApiError("Курьер не найден", 404);
  }

  const activeAssignments = await prisma.order.findMany({
    where: {
      courierId: userId,
      status: {
        in: activeOrderStatuses,
      },
    },
    select: {
      id: true,
      deliveryDate: true,
    },
  });
  const activeOrderIds = activeAssignments.map((order) => order.id);
  const affectedRouteDates = [
    ...new Set(activeAssignments.map((order) => format(order.deliveryDate, "yyyy-MM-dd"))),
  ];

  await prisma.$transaction((tx) => deleteStaffUser(tx, courier));

  await Promise.all(affectedRouteDates.map((date) => applyCourierRedistribution(date)));

  return {
    ok: true,
    deleted: true,
    redistributedOrders: activeOrderIds.length,
  };
}

export async function getAdminCourierBoard() {
  const courierProfiles = await prisma.courier.findMany({
    where: {
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          createdAt: true,
          assignedOrders: {
            select: {
              status: true,
              preliminaryTotal: true,
              finalTotal: true,
            },
          },
          deliveryTasks: {
            select: {
              status: true,
            },
          },
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return courierProfiles.map((profile) => {
    const orders = profile.user.assignedOrders;
    const tasks = profile.user.deliveryTasks;

    return {
      id: profile.userId,
      courierProfileId: profile.id,
      name: profile.name || profile.user.name,
      phone: profile.phone || profile.user.phone,
      createdAt: profile.user.createdAt,
      ordersCount: orders.length,
      activeOrders: orders.filter((order) => activeOrderStatuses.includes(order.status)).length,
      deliveredOrders: orders.filter((order) => order.status === OrderStatus.DELIVERED).length,
      issueOrders: orders.filter((order) => order.status === OrderStatus.DELIVERY_ISSUE).length,
      activeTasks: tasks.filter((task) => activeTaskStatuses.includes(task.status)).length,
      deliveredRevenue: orders
        .filter((order) => order.status === OrderStatus.DELIVERED)
        .reduce((sum, order) => sum + orderAmount(order), 0),
    };
  });
}

export async function getAdminPickers() {
  return prisma.user.findMany({
    where: {
      role: Role.PICKER,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function searchCourierDeliveryHistory(filters: {
  address?: string | null;
  date?: string | null;
  courierId?: string | null;
}) {
  const orderSearch = buildDeliveryHistorySearch(filters.address);
  const where: Prisma.DeliveryTaskWhereInput = {
    status: DeliveryTaskStatus.DELIVERED,
    courierId: filters.courierId || undefined,
    order: orderSearch ? { is: orderSearch } : undefined,
  };

  if (filters.date) {
    const { start, end } = getDateFilterRange(filters.date);

    where.deliveredAt = {
      gte: start,
      lt: end,
    };
  }

  return prisma.deliveryTask.findMany({
    where,
    include: {
      courier: {
        select: {
          id: true,
          name: true,
          phone: true,
          courierProfile: {
            select: {
              name: true,
              phone: true,
              isActive: true,
            },
          },
        },
      },
      order: {
        include: {
          user: true,
          address: true,
          deliveryTimeSlot: true,
        },
      },
    },
    orderBy: [{ deliveredAt: "desc" }, { order: { deliveryDate: "desc" } }],
    take: 80,
  });
}

export async function getAdminAnalytics() {
  const [orders, courierProfiles, timeSlots] = await Promise.all([
    prisma.order.findMany({
      include: {
        deliveryTimeSlot: true,
        courier: {
          select: {
            id: true,
            name: true,
          },
        },
        deliveryTask: {
          select: {
            status: true,
            problemType: true,
            deliveredAt: true,
          },
        },
      },
      orderBy: [{ deliveryDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.courier.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            assignedOrders: {
              select: {
                status: true,
                preliminaryTotal: true,
                finalTotal: true,
              },
            },
            deliveryTasks: {
              select: {
                status: true,
                deliveredAt: true,
                problemType: true,
              },
            },
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.deliveryTimeSlot.findMany({
      orderBy: { startTime: "asc" },
    }),
  ]);

  const revenueOrders = orders.filter((order) => order.status !== OrderStatus.CANCELLED);
  const revenue = revenueOrders.reduce((sum, order) => sum + orderAmount(order), 0);
  const lastDateKeys = getLastDateKeys(7);
  const ordersByDay = new Map(
    lastDateKeys.map((dateKey) => [
      dateKey,
      {
        date: dateKey,
        orders: 0,
        revenue: 0,
      },
    ]),
  );

  for (const order of orders) {
    const dateKey = format(order.deliveryDate, "yyyy-MM-dd");
    const day = ordersByDay.get(dateKey);

    if (day) {
      day.orders += 1;
      if (order.status !== OrderStatus.CANCELLED) {
        day.revenue += orderAmount(order);
      }
    }
  }

  const statusRows = Object.values(OrderStatus).map((status) => {
    const statusOrders = orders.filter((order) => order.status === status);
    const statusRevenue = statusOrders.reduce((sum, order) => sum + orderAmount(order), 0);

    return {
      status,
      label: orderStatusMeta[status]?.label ?? status,
      count: statusOrders.length,
      revenue: statusRevenue,
      share: orders.length > 0 ? Math.round((statusOrders.length / orders.length) * 100) : 0,
    };
  });

  const timeSlotRows = timeSlots.map((slot) => {
    const slotOrders = orders.filter((order) => order.deliveryTimeSlotId === slot.id);

    return {
      id: slot.id,
      title: slot.title,
      count: slotOrders.length,
      delivered: slotOrders.filter((order) => order.status === OrderStatus.DELIVERED).length,
      issues: slotOrders.filter((order) => order.status === OrderStatus.DELIVERY_ISSUE).length,
    };
  });

  const courierRows = courierProfiles.map((profile) => {
    const assignedOrders = profile.user.assignedOrders;
    const deliveredOrders = assignedOrders.filter(
      (order) => order.status === OrderStatus.DELIVERED,
    );
    const issueOrders = assignedOrders.filter(
      (order) => order.status === OrderStatus.DELIVERY_ISSUE,
    );

    return {
      id: profile.userId,
      name: profile.name || profile.user.name,
      phone: profile.phone || profile.user.phone,
      isActive: profile.isActive,
      assignedOrders: assignedOrders.length,
      activeOrders: assignedOrders.filter((order) => activeOrderStatuses.includes(order.status))
        .length,
      deliveredOrders: deliveredOrders.length,
      issueOrders: issueOrders.length,
      completionRate:
        assignedOrders.length > 0
          ? Math.round((deliveredOrders.length / assignedOrders.length) * 100)
          : 0,
      deliveredRevenue: deliveredOrders.reduce((sum, order) => sum + orderAmount(order), 0),
      problemTasks: profile.user.deliveryTasks.filter((task) => task.status === DeliveryTaskStatus.ISSUE)
        .length,
    };
  });

  return {
    orders: {
      total: orders.length,
      active: orders.filter((order) => activeOrderStatuses.includes(order.status)).length,
      delivered: orders.filter((order) => order.status === OrderStatus.DELIVERED).length,
      cancelled: orders.filter((order) => order.status === OrderStatus.CANCELLED).length,
      issues: orders.filter((order) => order.status === OrderStatus.DELIVERY_ISSUE).length,
      revenue,
      averageCheck: revenueOrders.length > 0 ? revenue / revenueOrders.length : 0,
      statusRows,
      timeSlotRows,
      dailyRows: Array.from(ordersByDay.values()),
    },
    couriers: {
      total: courierProfiles.length,
      active: courierProfiles.filter((courier) => courier.isActive).length,
      archived: courierProfiles.filter((courier) => !courier.isActive).length,
      assignedOrders: courierRows.reduce((sum, courier) => sum + courier.assignedOrders, 0),
      deliveredOrders: courierRows.reduce((sum, courier) => sum + courier.deliveredOrders, 0),
      rows: courierRows,
    },
  };
}
