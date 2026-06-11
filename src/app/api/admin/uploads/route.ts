import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { ApiError, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { saveUploadedImage } from "@/lib/upload-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError("Передайте файл изображения", 400);
    }

    return NextResponse.json({
      url: await saveUploadedImage(file, "catalog"),
    });
  } catch (error) {
    return jsonError(error);
  }
}
