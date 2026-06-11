import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
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

export const maxUploadImageSizeBytes = 20 * 1024 * 1024;

const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");

type CatalogImageKind = "product" | "category";

const catalogImagePresets = {
  product: {
    background: "#ffffff",
    height: 1200,
    quality: 92,
    width: 1600,
  },
  category: {
    background: "#f7fbf1",
    height: 640,
    quality: 90,
    width: 640,
  },
} satisfies Record<
  CatalogImageKind,
  { background: string; height: number; quality: number; width: number }
>;

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

async function normalizeCatalogImage(bytes: Buffer, kind: CatalogImageKind) {
  const preset = catalogImagePresets[kind];

  return sharp(bytes, { limitInputPixels: 80_000_000 })
    .rotate()
    .resize({
      width: preset.width,
      height: preset.height,
      fit: "contain",
      background: preset.background,
      withoutEnlargement: false,
    })
    .webp({ quality: preset.quality, effort: 5 })
    .toBuffer();
}

export async function saveUploadedImage(
  file: File,
  folder: "catalog" | "reviews",
  options?: { catalogKind?: CatalogImageKind },
) {
  if (file.size <= 0) {
    throw new ApiError("Файл пустой", 400);
  }

  if (file.size > maxUploadImageSizeBytes) {
    throw new ApiError("Изображение должно быть меньше 20 МБ", 413);
  }

  const originalExtension = allowedImageMimeTypes.get(file.type);

  if (!originalExtension) {
    throw new ApiError("Поддерживаются только AVIF, JPG, PNG и WEBP", 415);
  }

  const uploadDir = resolveInside(getUploadsRoot(), [folder]);
  const sourceBytes = Buffer.from(await file.arrayBuffer());
  const shouldNormalizeCatalogImage = folder === "catalog";
  const extension = shouldNormalizeCatalogImage
    ? "webp"
    : originalExtension;
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const bytes = shouldNormalizeCatalogImage
    ? await normalizeCatalogImage(sourceBytes, options?.catalogKind ?? "product")
    : sourceBytes;

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);

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
