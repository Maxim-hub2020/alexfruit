import { OrderStatus, Prisma } from "@/generated/prisma";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  adminProductReviewSchema,
  productReviewSchema,
} from "@/lib/validators";

export type ProductReviewSummary = {
  averageRating: number | null;
  reviewsCount: number;
};

function roundRating(value: number | null | undefined) {
  return value ? Math.round(value * 10) / 10 : null;
}

function emptySummary(): ProductReviewSummary {
  return {
    averageRating: null,
    reviewsCount: 0,
  };
}

export async function getProductReviewSummaries(productIds: string[]) {
  const uniqueProductIds = [...new Set(productIds)].filter(Boolean);
  const summaries = new Map<string, ProductReviewSummary>();

  for (const productId of uniqueProductIds) {
    summaries.set(productId, emptySummary());
  }

  if (uniqueProductIds.length === 0) {
    return summaries;
  }

  const rows = await prisma.productReview.groupBy({
    by: ["productId"],
    where: {
      productId: { in: uniqueProductIds },
      isPublished: true,
    },
    _avg: {
      rating: true,
    },
    _count: {
      _all: true,
    },
  });

  for (const row of rows) {
    summaries.set(row.productId, {
      averageRating: roundRating(row._avg.rating),
      reviewsCount: row._count._all,
    });
  }

  return summaries;
}

export async function addReviewSummaryToProducts<T extends { id: string }>(
  products: T[],
) {
  const summaries = await getProductReviewSummaries(
    products.map((product) => product.id),
  );

  return products.map((product) => ({
    ...product,
    ...(summaries.get(product.id) ?? emptySummary()),
  }));
}

function uniquePhotoUrls(urls: string[]) {
  return [...new Set(urls)].slice(0, 5);
}

export async function createProductReview(userId: string, input: unknown) {
  const data = productReviewSchema.parse(input);
  const orderItem = await prisma.orderItem.findFirst({
    where: {
      id: data.orderItemId,
      order: {
        userId,
        status: OrderStatus.DELIVERED,
      },
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
        },
      },
      review: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!orderItem) {
    throw new ApiError(
      "Отзыв можно оставить только после доставки товара из вашего заказа",
      404,
    );
  }

  if (!orderItem.productId || !orderItem.product) {
    throw new ApiError("Этот товар уже недоступен для отзыва", 400);
  }

  if (orderItem.review) {
    throw new ApiError("Вы уже оставили отзыв на эту позицию заказа", 409);
  }

  return prisma.productReview.create({
    data: {
      productId: orderItem.productId,
      orderId: orderItem.orderId,
      orderItemId: orderItem.id,
      userId,
      rating: data.rating,
      comment: data.comment || null,
      photos: {
        create: uniquePhotoUrls(data.photoUrls).map((url) => ({ url })),
      },
    },
    include: {
      photos: true,
      product: {
        select: {
          id: true,
          name: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
    },
  });
}

export async function getAdminProductReviews(filter?: string | null) {
  const where: Prisma.ProductReviewWhereInput =
    filter === "unanswered"
      ? { adminReply: null }
      : filter === "hidden"
        ? { isPublished: false }
        : {};

  return prisma.productReview.findMany({
    where,
    include: {
      photos: true,
      product: {
        include: {
          category: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          deliveryDate: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      adminReplyBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminProductReviewStats() {
  const [total, unanswered, hidden] = await Promise.all([
    prisma.productReview.count(),
    prisma.productReview.count({
      where: { adminReply: null },
    }),
    prisma.productReview.count({
      where: { isPublished: false },
    }),
  ]);

  return {
    total,
    unanswered,
    hidden,
  };
}

export async function updateProductReviewByAdmin(
  adminId: string,
  reviewId: string,
  input: unknown,
) {
  const rawInput =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const data = adminProductReviewSchema.parse(input);
  const hasAdminReply = Object.prototype.hasOwnProperty.call(
    rawInput,
    "adminReply",
  );
  const hasIsPublished = Object.prototype.hasOwnProperty.call(
    rawInput,
    "isPublished",
  );

  const existing = await prisma.productReview.findUnique({
    where: { id: reviewId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError("Отзыв не найден", 404);
  }

  return prisma.productReview.update({
    where: { id: reviewId },
    data: {
      ...(hasAdminReply
        ? {
            adminReply: data.adminReply || null,
            adminReplyAt: data.adminReply ? new Date() : null,
            adminReplyById: data.adminReply ? adminId : null,
          }
        : {}),
      ...(hasIsPublished && data.isPublished !== undefined
        ? { isPublished: data.isPublished }
        : {}),
    },
    include: {
      photos: true,
      product: {
        include: {
          category: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          deliveryDate: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      adminReplyBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}
