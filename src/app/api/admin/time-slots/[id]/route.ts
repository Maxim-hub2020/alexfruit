import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { timeSlotSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser([Role.ADMIN]);
    const { id } = await params;
    const data = timeSlotSchema.partial().parse(await request.json());
    const slot = await prisma.deliveryTimeSlot.update({
      where: { id },
      data,
    });
    return NextResponse.json(slot);
  } catch (error) {
    return jsonError(error);
  }
}
