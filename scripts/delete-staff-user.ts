import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Role } from "../src/generated/prisma/enums";

function normalizeRussianPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `+7${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  return value.trim();
}

const rawPhone = process.env.STAFF_PHONE ?? process.argv[2];

if (!rawPhone) {
  throw new Error("Set STAFF_PHONE or pass phone as the first argument.");
}

const phone = normalizeRussianPhone(rawPhone);

if (!/^\+7\d{10}$/.test(phone)) {
  throw new Error("Phone must be in +7XXXXXXXXXX format.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const user = await prisma.user.findUnique({
    where: { phone },
    include: {
      courierProfile: true,
    },
  });

  if (!user) {
    console.log(`Staff user not found: ${phone}`);
    return;
  }

  if (user.role === Role.ADMIN) {
    throw new Error(`Refusing to delete admin user: ${phone}`);
  }

  const isStaffUser =
    user.role === Role.COURIER || user.role === Role.PICKER || Boolean(user.courierProfile);

  if (!isStaffUser) {
    throw new Error(
      `Refusing to delete regular customer ${phone}. Use the admin UI or manual SQL if this is intentional.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.messengerAuthChallenge.deleteMany({
      where: {
        OR: [{ userId: user.id }, { phone }],
      },
    });

    await tx.user.delete({
      where: { id: user.id },
    });
  });

  console.log(`Deleted staff user: ${user.name} ${phone} (${user.role})`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
