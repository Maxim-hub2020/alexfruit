import { randomBytes } from "node:crypto";
import { Prisma, Role } from "@/generated/prisma";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  addSharedCartItemSchema,
  createSharedCartSchema,
  updateSharedCartItemSchema,
} from "@/lib/validators";

const SHARED_CART_TOKEN_BYTES = 12;

function createShareToken() {
  return randomBytes(SHARED_CART_TOKEN_BYTES).toString("base64url");
}

function canManageSharedCartItem({
  userId,
  role,
  ownerId,
  addedById,
}: {
  userId: string;
  role: Role;
  ownerId: string;
  addedById: string;
}) {
  return role === Role.ADMIN || userId === ownerId || userId === addedById;
}

async function findProduct(productId: string) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      isActive: true,
    },
  });

  if (!product) {
    throw new ApiError("Товар не найден или скрыт из каталога", 404);
  }

  return product;
}

async function findSharedCartByToken(token: string) {
  const sharedCart = await prisma.sharedCart.findUnique({
    where: { token },
  });

  if (!sharedCart || !sharedCart.isActive) {
    throw new ApiError("Общая корзина не найдена", 404);
  }

  return sharedCart;
}

function assertSharedCartEditable(sharedCart: { orderedAt?: Date | null }) {
  if (sharedCart.orderedAt) {
    throw new ApiError("Общая корзина уже оформлена в заказ и закрыта для изменений", 409);
  }
}

export type SharedCartWithItems = Prisma.SharedCartGetPayload<{
  include: {
    owner: { select: { id: true; name: true; phone: true } };
    items: {
      include: {
        addedBy: { select: { id: true; name: true; phone: true } };
        product: { select: { id: true; imageUrl: true; isActive: true } };
      };
    };
  };
}>;

export async function createSharedCart(ownerId: string, input: unknown) {
  const data = createSharedCartSchema.parse(input);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const token = createShareToken();

      return await prisma.sharedCart.create({
        data: {
          token,
          ownerId,
          title: data.title?.trim() || "Общая корзина АлексФрут",
        },
        include: {
          owner: { select: { id: true, name: true, phone: true } },
          items: {
            include: {
              addedBy: { select: { id: true, name: true, phone: true } },
              product: {
                select: { id: true, imageUrl: true, isActive: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new ApiError("Не удалось создать ссылку общей корзины", 500);
}

export async function getSharedCart(token: string) {
  return prisma.sharedCart.findFirst({
    where: {
      token,
      isActive: true,
    },
    include: {
      owner: { select: { id: true, name: true, phone: true } },
      items: {
        include: {
          addedBy: { select: { id: true, name: true, phone: true } },
          product: {
            select: { id: true, imageUrl: true, isActive: true },
          },
        },
        orderBy: [{ createdAt: "asc" }, { productName: "asc" }],
      },
    },
  });
}

export async function getOwnedSharedCarts(ownerId: string) {
  return prisma.sharedCart.findMany({
    where: {
      ownerId,
      isActive: true,
    },
    include: {
      items: true,
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          deliveryDate: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function leaveSharedCart(
  token: string,
  user: { id: string; role: Role },
) {
  const sharedCart = await findSharedCartByToken(token);
  assertSharedCartEditable(sharedCart);

  if (sharedCart.ownerId === user.id && user.role !== Role.ADMIN) {
    throw new ApiError(
      "Организатор не выходит из общей корзины, а удаляет её целиком.",
      400,
    );
  }

  const result = await prisma.sharedCartItem.deleteMany({
    where: {
      sharedCartId: sharedCart.id,
      addedById: user.id,
    },
  });

  return { left: true, removedItems: result.count };
}

export async function deleteSharedCart(
  token: string,
  user: { id: string; role: Role },
) {
  const sharedCart = await findSharedCartByToken(token);

  if (sharedCart.ownerId !== user.id && user.role !== Role.ADMIN) {
    throw new ApiError("Удалить общую корзину может только её создатель.", 403);
  }

  await prisma.sharedCart.update({
    where: { id: sharedCart.id },
    data: { isActive: false },
  });

  return { deleted: true };
}

export async function addSharedCartItem(
  token: string,
  userId: string,
  input: unknown,
) {
  const data = addSharedCartItemSchema.parse(input);
  const [sharedCart, product] = await Promise.all([
    findSharedCartByToken(token),
    findProduct(data.productId),
  ]);
  assertSharedCartEditable(sharedCart);

  return prisma.sharedCartItem.upsert({
    where: {
      sharedCartId_productId_addedById: {
        sharedCartId: sharedCart.id,
        productId: product.id,
        addedById: userId,
      },
    },
    create: {
      sharedCartId: sharedCart.id,
      productId: product.id,
      addedById: userId,
      productName: product.name,
      price: product.price,
      unit: product.unit,
      quantity: data.quantity,
    },
    update: {
      productName: product.name,
      price: product.price,
      unit: product.unit,
      quantity: {
        increment: data.quantity,
      },
    },
  });
}

export async function updateSharedCartItem(
  token: string,
  itemId: string,
  user: { id: string; role: Role },
  input: unknown,
) {
  const data = updateSharedCartItemSchema.parse(input);
  const sharedCart = await findSharedCartByToken(token);
  assertSharedCartEditable(sharedCart);
  const item = await prisma.sharedCartItem.findFirst({
    where: {
      id: itemId,
      sharedCartId: sharedCart.id,
    },
  });

  if (!item) {
    throw new ApiError("Позиция общей корзины не найдена", 404);
  }

  if (
    !canManageSharedCartItem({
      userId: user.id,
      role: user.role,
      ownerId: sharedCart.ownerId,
      addedById: item.addedById,
    })
  ) {
    throw new ApiError("Можно менять только свои позиции в общей корзине", 403);
  }

  if (data.quantity <= 0) {
    await prisma.sharedCartItem.delete({ where: { id: item.id } });
    return { deleted: true };
  }

  return prisma.sharedCartItem.update({
    where: { id: item.id },
    data: { quantity: data.quantity },
  });
}

export async function deleteSharedCartItem(
  token: string,
  itemId: string,
  user: { id: string; role: Role },
) {
  const sharedCart = await findSharedCartByToken(token);
  assertSharedCartEditable(sharedCart);
  const item = await prisma.sharedCartItem.findFirst({
    where: {
      id: itemId,
      sharedCartId: sharedCart.id,
    },
  });

  if (!item) {
    throw new ApiError("Позиция общей корзины не найдена", 404);
  }

  if (
    !canManageSharedCartItem({
      userId: user.id,
      role: user.role,
      ownerId: sharedCart.ownerId,
      addedById: item.addedById,
    })
  ) {
    throw new ApiError("Можно удалять только свои позиции в общей корзине", 403);
  }

  await prisma.sharedCartItem.delete({ where: { id: item.id } });
  return { deleted: true };
}
