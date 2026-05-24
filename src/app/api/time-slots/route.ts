import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";

export async function GET() {
  try {
    const slots = await prisma.deliveryTimeSlot.findMany({
      where: { isActive: true },
      orderBy: { startTime: "asc" },
    });
    return NextResponse.json(slots);
  } catch (error) {
    return jsonError(error);
  }
}
