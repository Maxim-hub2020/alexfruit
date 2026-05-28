import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ||
  (process.env.POSTGRES_PASSWORD
    ? `postgresql://${process.env.POSTGRES_USER || "alexfrut"}:${process.env.POSTGRES_PASSWORD}@db:5432/${process.env.POSTGRES_DB || "alexfrut"}`
    : "postgresql://alexfrut:placeholder@db:5432/alexfrut");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
