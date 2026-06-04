import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { ApiError, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedMimeTypes = new Map([
  ["image/avif", "avif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const maxImageSizeBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await requireApiUser([Role.CUSTOMER]);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError("Передайте фото отзыва", 400);
    }

    if (file.size <= 0) {
      throw new ApiError("Файл пустой", 400);
    }

    if (file.size > maxImageSizeBytes) {
      throw new ApiError("Фото должно быть меньше 5 МБ", 413);
    }

    const extension = allowedMimeTypes.get(file.type);

    if (!extension) {
      throw new ApiError("Поддерживаются только AVIF, JPG, PNG и WEBP", 415);
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "reviews");
    const filename = `${Date.now()}-${randomUUID()}.${extension}`;
    const bytes = await file.arrayBuffer();

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));

    return NextResponse.json({
      url: `/uploads/reviews/${filename}`,
    });
  } catch (error) {
    return jsonError(error);
  }
}
