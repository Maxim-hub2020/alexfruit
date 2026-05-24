import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDeliveryBoard } from "@/lib/orders";

export async function GET(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const { searchParams } = new URL(request.url);
    const board = await getDeliveryBoard({
      date: searchParams.get("date"),
      courierId: searchParams.get("courierId"),
      timeSlotId: searchParams.get("timeSlotId"),
    });
    return NextResponse.json(board);
  } catch (error) {
    return jsonError(error);
  }
}
