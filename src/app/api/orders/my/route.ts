import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getCustomerOrders } from "@/lib/orders";

export async function GET() {
  try {
    const user = await requireApiUser();
    const orders = await getCustomerOrders(user.id);
    return NextResponse.json(orders);
  } catch (error) {
    return jsonError(error);
  }
}
