import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || "alexfrut"}:${process.env.POSTGRES_PASSWORD}@db:5432/${process.env.POSTGRES_DB || "alexfrut"}`;

if (!databaseUrl || databaseUrl.includes("undefined")) {
  throw new Error(
    "DATABASE_URL is missing. Set DATABASE_URL or POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
