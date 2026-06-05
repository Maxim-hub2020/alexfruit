import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, jsonError } from "@/lib/api";
import { normalizeRussianPhone } from "@/lib/auth";
import { prisma } from "@/lib/db";

const checkPhoneSchema = z.object({
  phone: z.string().trim().min(10, "Укажите телефон"),
});

export async function POST(request: Request) {
  try {
    const data = checkPhoneSchema.parse(await request.json());
    const phone = normalizeRussianPhone(data.phone);

    if (!/^\+7\d{10}$/.test(phone)) {
      throw new ApiError("Укажите телефон в формате +7XXXXXXXXXX", 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });

    return NextResponse.json({
      phone,
      exists: Boolean(existingUser),
    });
  } catch (error) {
    return jsonError(error);
  }
}
