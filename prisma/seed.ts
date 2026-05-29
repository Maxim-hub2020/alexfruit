import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import {
  DeliveryTaskStatus,
  OrderStatus,
  PrismaClient,
  ProductUnit,
  Role,
  StockStatus,
} from "../src/generated/prisma";

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.replace(/^\uFEFF/, "").match(/^([A-Z0-9_]+)=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    process.env[key] = rawValue.replace(/^"|"$/g, "");
  }
}

loadLocalEnv();

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/alexfrut",
});

const prisma = new PrismaClient({ adapter });

async function upsertUser(params: {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: Role;
}) {
  const passwordHash = await bcrypt.hash(params.password, 10);
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: params.email }, { phone: params.phone }],
    },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        email: params.email,
        name: params.name,
        phone: params.phone,
        role: params.role,
        passwordHash,
      },
    });
  }

  return prisma.user.create({
    data: {
      email: params.email,
      name: params.name,
      phone: params.phone,
      role: params.role,
      passwordHash,
    },
  });
}

async function main() {
  const admin = await upsertUser({
    email: process.env.DEFAULT_ADMIN_EMAIL ?? "admin@alexfrut.local",
    password: process.env.DEFAULT_ADMIN_PASSWORD ?? "admin12345",
    name: "Марина Админ",
    phone: "+79000000001",
    role: Role.ADMIN,
  });

  const courier = await upsertUser({
    email: process.env.DEFAULT_COURIER_EMAIL ?? "courier@alexfrut.local",
    password: process.env.DEFAULT_COURIER_PASSWORD ?? "courier12345",
    name: "Илья Курьер",
    phone: "+79000000002",
    role: Role.COURIER,
  });

  const customer = await upsertUser({
    email: process.env.DEFAULT_CUSTOMER_EMAIL ?? "customer@alexfrut.local",
    password: process.env.DEFAULT_CUSTOMER_PASSWORD ?? "customer12345",
    name: "Елена Соколова",
    phone: "+79000000003",
    role: Role.CUSTOMER,
  });

  await prisma.customerProfile.upsert({
    where: { userId: customer.id },
    update: {},
    create: { userId: customer.id },
  });

  await prisma.courier.upsert({
    where: { userId: courier.id },
    update: {
      name: courier.name,
      phone: courier.phone,
    },
    create: {
      userId: courier.id,
      name: courier.name,
      phone: courier.phone,
      isActive: true,
    },
  });

  const address = await prisma.address.upsert({
    where: { id: "customer-default-address" },
    update: {
      userId: customer.id,
      title: "Дом",
      city: "Ростов-на-Дону",
      street: "Пушкинская",
      house: "104",
      apartment: "18",
      entrance: "2",
      floor: "5",
      comment: "Позвонить за 10 минут",
      latitude: 47.2288,
      longitude: 39.7291,
      isDefault: true,
    },
    create: {
      id: "customer-default-address",
      userId: customer.id,
      title: "Дом",
      city: "Ростов-на-Дону",
      street: "Пушкинская",
      house: "104",
      apartment: "18",
      entrance: "2",
      floor: "5",
      comment: "Позвонить за 10 минут",
      latitude: 47.2288,
      longitude: 39.7291,
      isDefault: true,
    },
  });

  await prisma.customerProfile.update({
    where: { userId: customer.id },
    data: {
      defaultAddressId: address.id,
    },
  });

  const categories = [
    { name: "Фрукты", slug: "frukty", sortOrder: 1 },
    { name: "Овощи", slug: "ovoschi", sortOrder: 2 },
    { name: "Зелень", slug: "zelen", sortOrder: 3 },
    { name: "Ягоды", slug: "yagody", sortOrder: 4 },
    { name: "Орехи", slug: "orehi", sortOrder: 5 },
    { name: "Сухофрукты", slug: "suhofrukty", sortOrder: 6 },
    { name: "Готовые наборы", slug: "nabory", sortOrder: 7 },
    { name: "Акции", slug: "aktsii", sortOrder: 8 },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  const categoryMap = new Map(
    (
      await prisma.category.findMany({
        where: { slug: { in: categories.map((category) => category.slug) } },
      })
    ).map((category) => [category.slug, category.id]),
  );

  const products = [
    {
      categorySlug: "frukty",
      name: "Яблоки Гренни Смит",
      description: "Хрустящие зелёные яблоки для соков и закусок.",
      price: 210,
      unit: ProductUnit.KG,
      imageUrl:
        "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=900&q=80",
      isHit: true,
      isNew: false,
      isPromo: false,
    },
    {
      categorySlug: "frukty",
      name: "Черешня отборная",
      description: "Сладкая крупная черешня без лишней обработки.",
      price: 540,
      unit: ProductUnit.KG,
      imageUrl:
        "https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=900&q=80",
      isHit: true,
      isNew: true,
      isPromo: false,
    },
    {
      categorySlug: "yagody",
      name: "Клубника фермерская",
      description: "Яркая, сладкая клубника в удобной упаковке 500 г.",
      price: 390,
      unit: ProductUnit.PACK,
      imageUrl:
        "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=900&q=80",
      isHit: true,
      isNew: true,
      isPromo: true,
    },
    {
      categorySlug: "ovoschi",
      name: "Томаты розовые",
      description: "Мясистые сладкие томаты для салатов и брускетты.",
      price: 280,
      unit: ProductUnit.KG,
      imageUrl:
        "https://images.unsplash.com/photo-1582284540020-8acbe03f4924?auto=format&fit=crop&w=900&q=80",
      isHit: false,
      isNew: false,
      isPromo: true,
    },
    {
      categorySlug: "zelen",
      name: "Мята свежая",
      description: "Пучок ароматной мяты для напитков и десертов.",
      price: 120,
      unit: ProductUnit.PACK,
      imageUrl:
        "https://images.unsplash.com/photo-1628557044797-f21a177c37ec?auto=format&fit=crop&w=900&q=80",
      isHit: false,
      isNew: true,
      isPromo: false,
    },
    {
      categorySlug: "nabory",
      name: "Набор на неделю",
      description: "Собранный набор фруктов и овощей для семьи из 3-4 человек.",
      price: 1890,
      unit: ProductUnit.PIECE,
      imageUrl:
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
      isHit: true,
      isNew: false,
      isPromo: true,
    },
  ];

  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          categoryId: categoryMap.get(product.categorySlug)!,
          description: product.description,
          price: product.price,
          unit: product.unit,
          imageUrl: product.imageUrl,
          isActive: true,
          isHit: product.isHit,
          isNew: product.isNew,
          isPromo: product.isPromo,
          stockStatus: StockStatus.IN_STOCK,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          categoryId: categoryMap.get(product.categorySlug)!,
          name: product.name,
          description: product.description,
          price: product.price,
          unit: product.unit,
          imageUrl: product.imageUrl,
          isActive: true,
          isHit: product.isHit,
          isNew: product.isNew,
          isPromo: product.isPromo,
          stockStatus: StockStatus.IN_STOCK,
        },
      });
    }
  }

  const timeSlots = [
    { title: "09:00-11:00", startTime: "09:00", endTime: "11:00", maxOrders: 5 },
    { title: "11:00-13:00", startTime: "11:00", endTime: "13:00", maxOrders: 7 },
    { title: "13:00-15:00", startTime: "13:00", endTime: "15:00", maxOrders: 8 },
    { title: "15:00-17:00", startTime: "15:00", endTime: "17:00", maxOrders: 8 },
    { title: "17:00-19:00", startTime: "17:00", endTime: "19:00", maxOrders: 10 },
    { title: "19:00-21:00", startTime: "19:00", endTime: "21:00", maxOrders: 6 },
  ];

  for (const slot of timeSlots) {
    await prisma.deliveryTimeSlot.upsert({
      where: { title: slot.title },
      update: slot,
      create: slot,
    });
  }

  const todayDeliveryDate = new Date(
    `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
  );

  const demoOrderNumber = "1001";
  const legacyDemoOrderNumber = "AF-DEMO-0001";
  const compactDemoOrder = await prisma.order.findFirst({
    where: { orderNumber: demoOrderNumber },
  });
  const legacyDemoOrder = compactDemoOrder
    ? null
    : await prisma.order.findFirst({
        where: { orderNumber: legacyDemoOrderNumber },
      });
  const orderExists = compactDemoOrder ?? legacyDemoOrder;

  if (orderExists) {
    const slot = await prisma.deliveryTimeSlot.findFirst({
      where: { title: "09:00-11:00" },
    });

    if (slot) {
      await prisma.order.update({
        where: { id: orderExists.id },
        data: {
          ...(orderExists.orderNumber !== demoOrderNumber
            ? { orderNumber: demoOrderNumber }
            : {}),
          userId: customer.id,
          addressId: address.id,
          deliveryDate: todayDeliveryDate,
          deliveryTimeSlotId: slot.id,
          status: OrderStatus.ASSEMBLING,
          courierId: courier.id,
          editableUntil: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      await prisma.deliveryTask.upsert({
        where: { orderId: orderExists.id },
        update: {
          courierId: courier.id,
          status: DeliveryTaskStatus.ASSIGNED,
          routeOrder: 1,
        },
        create: {
          orderId: orderExists.id,
          courierId: courier.id,
          status: DeliveryTaskStatus.ASSIGNED,
          routeOrder: 1,
        },
      });
    }
  }

  if (!orderExists) {
    const productsForOrder = await prisma.product.findMany({
      take: 3,
      orderBy: { createdAt: "asc" },
    });
    const slot = await prisma.deliveryTimeSlot.findFirst({
      where: { title: "09:00-11:00" },
    });

    if (slot && productsForOrder.length > 0) {
      const order = await prisma.order.create({
        data: {
          orderNumber: demoOrderNumber,
          userId: customer.id,
          addressId: address.id,
          deliveryDate: todayDeliveryDate,
          deliveryTimeSlotId: slot.id,
          status: OrderStatus.ASSEMBLING,
          preliminaryTotal: 2350,
          finalTotal: 2410,
          customerComment: "Нужны самые спелые ягоды",
          adminComment: "Добавить салфетки",
          courierId: courier.id,
          editableUntil: new Date(Date.now() + 30 * 60 * 1000),
          items: {
            createMany: {
              data: productsForOrder.map((product, index) => ({
                productId: product.id,
                productName: product.name,
                price: Number(product.price),
                unit: product.unit,
                orderedQuantity: index === 0 ? 2 : 1,
                actualQuantity: index === 0 ? 2.1 : 1,
                preliminarySum: Number(product.price) * (index === 0 ? 2 : 1),
                finalSum:
                  Number(product.price) * (index === 0 ? 2.1 : 1),
              })),
            },
          },
        },
      });

      await prisma.deliveryTask.create({
        data: {
          orderId: order.id,
          courierId: courier.id,
          status: DeliveryTaskStatus.ASSIGNED,
          routeOrder: 1,
        },
      });
    }
  }

  console.log("Seed completed");
  console.log(`Admin: ${admin.email} / ${process.env.DEFAULT_ADMIN_PASSWORD ?? "admin12345"}`);
  console.log(
    `Courier: ${courier.email} / ${process.env.DEFAULT_COURIER_PASSWORD ?? "courier12345"}`,
  );
  console.log(
    `Customer: ${customer.email} / ${process.env.DEFAULT_CUSTOMER_PASSWORD ?? "customer12345"}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
