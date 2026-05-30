import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Role } from "../src/generated/prisma/enums";

const phone = process.env.ADMIN_PHONE;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME || "Администратор";

if (!phone || !/^\+7\d{10}$/.test(phone)) {
  throw new Error("ADMIN_PHONE должен быть в формате +7XXXXXXXXXX");
}

if (!password || password.length < 8) {
  throw new Error("ADMIN_PASSWORD должен быть не короче 8 символов");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL не задан");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { phone },
    update: { name, passwordHash, role: Role.ADMIN },
    create: { name, phone, passwordHash, role: Role.ADMIN },
  });

  console.log(`Admin ready: ${user.name} ${user.phone}`);
} finally {
  await prisma.$disconnect();
}
