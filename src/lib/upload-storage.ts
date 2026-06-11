import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/api";

const allowedImageMimeTypes = new Map([
  ["image/avif", "avif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const responseMimeTypes = new Map([
  ["avif", "image/avif"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);

export const maxUploadImageSizeBytes = 5 * 1024 * 1024;

const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");

function getUploadsRoot() {
  return uploadsRoot;
}

function assertSafeUploadSegments(segments: string[]) {
  if (
    segments.length === 0 ||
    segments.some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment))
  ) {
    throw new ApiError("Некорректный путь к файлу", 400);
  }
}

function resolveInside(root: string, segments: string[]) {
  const target = path.resolve(root, ...segments);
  const relative = path.relative(root, target);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ApiError("Некорректный путь к файлу", 400);
  }

  return target;
}

export async function saveUploadedImage(file: File, folder: "catalog" | "reviews") {
  if (file.size <= 0) {
    throw new ApiError("Файл пустой", 400);
  }

  if (file.size > maxUploadImageSizeBytes) {
    throw new ApiError("Изображение должно быть меньше 5 МБ", 413);
  }

  const extension = allowedImageMimeTypes.get(file.type);

  if (!extension) {
    throw new ApiError("Поддерживаются только AVIF, JPG, PNG и WEBP", 415);
  }

  const uploadDir = resolveInside(getUploadsRoot(), [folder]);
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const bytes = await file.arrayBuffer();

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));

  return `/uploads/${folder}/${filename}`;
}

export async function getUploadFileResponse(segments: string[]) {
  assertSafeUploadSegments(segments);

  const uploadsRoot = getUploadsRoot();
  const filePath = resolveInside(uploadsRoot, segments);
  const extension = path.extname(filePath).slice(1).toLowerCase();
  const contentType = responseMimeTypes.get(extension);

  if (!contentType) {
    throw new ApiError("Неподдерживаемый тип файла", 415);
  }

  try {
    const fileInfo = await stat(filePath);

    if (!fileInfo.isFile()) {
      throw new ApiError("Файл не найден", 404);
    }

    const file = await readFile(filePath);

    return new Response(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(fileInfo.size),
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError("Файл не найден", 404);
  }
}
