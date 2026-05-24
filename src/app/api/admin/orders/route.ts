import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getAdminOrders } from "@/lib/orders";

export async function GET(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const { searchParams } = new URL(request.url);
    const orders = await getAdminOrders({
      date: searchParams.get("date"),
      status: searchParams.get("status"),
      customer: searchParams.get("customer"),
      courierId: searchParams.get("courierId"),
      timeSlotId: searchParams.get("timeSlotId"),
    });
    return NextResponse.json(orders);
  } catch (error) {
    return jsonError(error);
  }
}
