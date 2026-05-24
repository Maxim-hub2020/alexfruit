import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getCustomerOrderById } from "@/lib/orders";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const order = await getCustomerOrderById(user.id, id);
    return NextResponse.json(order);
  } catch (error) {
    return jsonError(error);
  }
}
