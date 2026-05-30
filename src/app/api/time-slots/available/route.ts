import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getAvailableTimeSlots } from "@/lib/orders";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const addressId = searchParams.get("addressId");
    const excludeOrderId = searchParams.get("excludeOrderId");

    if (!date || !addressId) {
      return NextResponse.json([]);
    }

    const slots = await getAvailableTimeSlots(date, {
      userId: user.id,
      addressId,
      excludeOrderId,
    });

    return NextResponse.json(slots);
  } catch (error) {
    return jsonError(error);
  }
}
