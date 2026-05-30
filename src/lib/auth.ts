import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma";
import { ApiError } from "@/lib/api";
import { AUTH_COOKIE_NAME } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  customerProfileSchema,
  loginSchema,
  registerSchema,
} from "@/lib/validators";

export type SessionPayload = {
  userId: string;
  role: Role;
  name: string;
};

function getJwtSecret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? "local-development-secret-change-me",
  );
}

function shouldUseSecureCookies() {
  const appUrl = process.env.APP_URL;

  if (appUrl) {
    try {
      return new URL(appUrl).protocol === "https:";
    } catch {
      return appUrl.startsWith("https://");
    }
  }

  return process.env.NODE_ENV === "production";
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function normalizeRussianPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `+7${digits.slice(1)}`;
  }

  return value.trim();
}

function createDefaultCustomerName(phone: string) {
  return `Клиент ${phone.slice(-4)}`;
}

export async function createSession(user: SessionPayload) {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function readSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await readSession();

  if (!session?.userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      customerProfile: true,
      courierProfile: true,
      notifications: {
        orderBy: { createdAt: "desc" },
        take: 6,
      },
    },
  });
}

export async function requirePageUser(roles?: Role[]) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (roles && !roles.includes(user.role)) {
    if (user.role === Role.ADMIN) {
      redirect("/admin");
    }

    if (user.role === Role.COURIER) {
      redirect("/courier");
    }

    redirect("/");
  }

  return user;
}

export async function requireApiUser(roles?: Role[]) {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApiError("Требуется авторизация", 401);
  }

  if (roles && !roles.includes(user.role)) {
    throw new ApiError("Недостаточно прав", 403);
  }

  return user;
}

export async function registerAndLogin(input: unknown) {
  const data = registerSchema.parse(input);
  const phone = data.phone;

  const existing = await prisma.user.findFirst({
    where: {
      phone,
    },
  });

  if (existing) {
    throw new ApiError("Пользователь с таким телефоном уже существует", 409);
  }

  const user = await prisma.user.create({
    data: {
      name: createDefaultCustomerName(phone),
      email: null,
      phone,
      passwordHash: await hashPassword(data.password),
      role: Role.CUSTOMER,
      customerProfile: {
        create: {},
      },
    },
  });

  await createSession({
    userId: user.id,
    role: user.role,
    name: user.name,
  });

  return user;
}

export async function updateCustomerProfile(userId: string, input: unknown) {
  const data = customerProfileSchema.parse(input);
  const email = data.email || null;
  const phone = data.phone ? normalizeRussianPhone(data.phone) : null;
  const duplicateFilters = [
    ...(email ? [{ email }] : []),
    ...(phone ? [{ phone }] : []),
  ];

  const existing =
    duplicateFilters.length > 0
      ? await prisma.user.findFirst({
          where: {
            id: { not: userId },
            OR: duplicateFilters,
          },
        })
      : null;

  if (existing) {
    throw new ApiError("Пользователь с таким телефоном уже существует", 409);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      email,
      phone,
    },
  });

  await createSession({
    userId: user.id,
    role: user.role,
    name: user.name,
  });

  return user;
}

export async function loginAndCreateSession(input: unknown) {
  const data = loginSchema.parse(input);
  const normalizedPhone = normalizeRussianPhone(data.phone);

  if (!/^\+7\d{10}$/.test(normalizedPhone)) {
    throw new ApiError("Укажите телефон в формате +7XXXXXXXXXX", 400);
  }

  const user = await prisma.user.findFirst({
    where: {
      phone: normalizedPhone,
    },
  });

  if (!user) {
    throw new ApiError("Пользователь с таким телефоном не найден", 401);
  }

  const isValid = await verifyPassword(data.password, user.passwordHash);

  if (!isValid) {
    throw new ApiError("Неверный пароль", 401);
  }

  await createSession({
    userId: user.id,
    role: user.role,
    name: user.name,
  });

  return user;
}
