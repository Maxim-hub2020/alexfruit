import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const databasePoolMax = Number.parseInt(
  process.env.DATABASE_POOL_MAX ??
    (process.env.NODE_ENV === "development" ? "1" : "10"),
  10,
);

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/alexfrut",
  max: Number.isFinite(databasePoolMax) && databasePoolMax > 0 ? databasePoolMax : 1,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function isClosedConnectionError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const details = error as {
    code?: string;
    message?: string;
    meta?: { driverAdapterError?: { cause?: { originalCode?: string } } };
  };

  return (
    details.code === "P1017" ||
    details.meta?.driverAdapterError?.cause?.originalCode === "57P01" ||
    details.message?.includes("Server has closed the connection") ||
    details.message?.includes("Connection terminated unexpectedly")
  );
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function readWithPrismaRetry<T>(query: () => Promise<T>) {
  try {
    return await query();
  } catch (error) {
    if (!isClosedConnectionError(error)) {
      throw error;
    }

    await prisma.$disconnect().catch(() => undefined);
    await wait(150);
    return query();
  }
}
