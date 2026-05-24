import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { timeSlotSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const data = timeSlotSchema.parse(await request.json());
    const slot = await prisma.deliveryTimeSlot.create({
      data,
    });
    return NextResponse.json(slot);
  } catch (error) {
    return jsonError(error);
  }
}
