import {
  DeliveryTaskStatus,
  OrderStatus,
  ProblemType,
  ProductUnit,
} from "@/generated/prisma";
import { z } from "zod";

const emailOrPhone = z
  .object({
    email: z.string().trim().email().optional().or(z.literal("")),
    phone: z.string().trim().min(10).optional().or(z.literal("")),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Укажите email или телефон",
  });

export const registerSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+7\d{10}$/, "Укажите телефон в формате +7XXXXXXXXXX"),
  password: z.string().min(6, "Минимум 6 символов"),
  messengerChallengeId: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().min(1, "Подтвердите телефон через MAX"),
  ),
});

export const customerProfileSchema = emailOrPhone.extend({
  name: z.string().trim().min(2, "Укажите имя"),
});

export const loginSchema = z.object({
  phone: z.string().trim().min(10, "Укажите телефон"),
  password: z.string().min(6, "Минимум 6 символов"),
});

export const messengerAuthProviderSchema = z.enum(["TELEGRAM", "MAX"]);
export const messengerClientPlatformSchema = z.enum([
  "ANDROID",
  "IOS",
  "DESKTOP",
  "OTHER",
]);

export const messengerAuthStartSchema = z.object({
  provider: messengerAuthProviderSchema,
  phone: z.string().trim().min(10, "Укажите телефон"),
  clientPlatform: messengerClientPlatformSchema.optional(),
});

export const messengerAuthCompleteSchema = z.object({
  id: z.string().trim().min(1),
});

export const maxAuthStartSchema = z.object({
  phone: z.string().trim().min(10, "Укажите телефон"),
  clientPlatform: messengerClientPlatformSchema.optional(),
});

export const maxAuthClaimReturnSchema = z.object({
  state: z.string().trim().min(1),
  token: z.string().trim().min(20),
});

export const addressSchema = z.object({
  title: z.string().trim().min(2),
  city: z.string().trim().min(2),
  street: z.string().trim().min(2),
  house: z.string().trim().min(1),
  apartment: z.string().trim().optional().or(z.literal("")),
  entrance: z.string().trim().optional().or(z.literal("")),
  floor: z.string().trim().optional().or(z.literal("")),
  comment: z.string().trim().optional().or(z.literal("")),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  isDefault: z.coerce.boolean().optional().default(false),
});

const imageSourceSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (value === "") {
      return true;
    }

    if (/^\/[A-Za-z0-9/_-]+\.(avif|jpe?g|png|svg|webp)$/i.test(value)) {
      return true;
    }

    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Укажите ссылку на изображение или путь вида /products/image.webp");

export const categorySchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  imageUrl: imageSourceSchema.optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().optional().default(true),
});

export const productSchema = z.object({
  categoryId: z.string().trim().min(1),
  name: z.string().trim().min(2),
  description: z.string().trim().optional().or(z.literal("")),
  price: z.coerce.number().positive(),
  unit: z.nativeEnum(ProductUnit),
  imageUrl: imageSourceSchema.optional().or(z.literal("")),
  isActive: z.coerce.boolean().optional().default(true),
  isHit: z.coerce.boolean().optional().default(false),
  isNew: z.coerce.boolean().optional().default(false),
  isPromo: z.coerce.boolean().optional().default(false),
});

const reviewPhotoUrlSchema = z
  .string()
  .trim()
  .regex(
    /^\/uploads\/reviews\/[A-Za-z0-9._-]+\.(avif|jpe?g|png|webp)$/i,
    "Фото отзыва должно быть загружено через приложение",
  );

export const productReviewSchema = z.object({
  orderItemId: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
  photoUrls: z.array(reviewPhotoUrlSchema).max(5).optional().default([]),
});

export const adminProductReviewSchema = z.object({
  adminReply: z.string().trim().max(1000).optional().or(z.literal("")),
  isPublished: z.coerce.boolean().optional(),
});

export const dailyInventorySchema = z.object({
  date: z.string().trim().min(10),
  items: z.array(
    z.object({
      productId: z.string().trim().min(1),
      quantityStart: z.coerce.number().min(0),
    }),
  ),
});

export const orderLineSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  actualQuantity: z.coerce.number().positive().optional(),
});

const orderBaseObjectSchema = z.object({
  addressId: z.string().trim().min(1),
  deliveryDate: z.string().trim().min(10),
  deliveryTimeSlotId: z.string().trim().min(1).optional().or(z.literal("")),
  needsLift: z.coerce.boolean().optional().default(false),
  customerComment: z.string().trim().optional().or(z.literal("")),
  items: z.array(orderLineSchema).optional().default([]),
  sharedCartToken: z.string().trim().min(1).optional(),
});

export const createOrderSchema = orderBaseObjectSchema.refine((data) => Boolean(data.sharedCartToken) || data.items.length > 0, {
  message: "Корзина не может быть пустой",
  path: ["items"],
});

export const orderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  adminComment: z.string().trim().optional().or(z.literal("")),
});

export const orderEditSchema = orderBaseObjectSchema.omit({ sharedCartToken: true }).extend({
  items: z.array(orderLineSchema).min(1),
  status: z.nativeEnum(OrderStatus).optional(),
});

export const orderItemsSchema = z.object({
  items: z.array(orderLineSchema).min(1),
});

export const orderActualItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().trim().min(1),
      actualQuantity: z.coerce.number().positive().nullable().optional(),
    }),
  ).min(1),
});

export const orderRescheduleSchema = z.object({
  deliveryDate: z.string().trim().min(10),
  deliveryTimeSlotId: z.string().trim().min(1).optional().or(z.literal("")),
});

export const replacementDecisionSchema = z.object({
  notificationId: z.string().trim().min(1),
});

export const assignCourierSchema = z.object({
  courierId: z.string().trim().nullable().optional(),
});

export const adminCourierSchema = z.object({
  phone: z.string().trim().min(10, "Укажите телефон курьера"),
  name: z.string().trim().min(2, "Укажите имя курьера"),
  password: z.string().min(6, "Минимум 6 символов"),
});

export const adminPickerSchema = z.object({
  phone: z.string().trim().min(10, "Укажите телефон сборщика"),
  name: z.string().trim().min(2, "Укажите имя сборщика"),
  password: z.string().min(6, "Минимум 6 символов"),
});

export const courierTaskStatusSchema = z.object({
  status: z.nativeEnum(DeliveryTaskStatus),
});

export const courierProblemSchema = z.object({
  problemType: z.nativeEnum(ProblemType),
  problemComment: z.string().trim().optional().or(z.literal("")),
});

export const courierLocationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(100000).nullable().optional(),
});

export const timeSlotSchema = z.object({
  title: z.string().trim().min(2),
  startTime: z.string().trim().min(4),
  endTime: z.string().trim().min(4),
  maxOrders: z.coerce.number().int().positive(),
  isActive: z.coerce.boolean().optional().default(true),
});

export const sharedCartLineSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().positive().max(999),
});

export const createSharedCartSchema = z.object({
  title: z
    .string()
    .trim()
    .max(80, "Название общей корзины слишком длинное")
    .optional()
    .or(z.literal("")),
});

export const addSharedCartItemSchema = sharedCartLineSchema;

export const updateSharedCartItemSchema = z.object({
  quantity: z.coerce.number().min(0).max(999),
});
