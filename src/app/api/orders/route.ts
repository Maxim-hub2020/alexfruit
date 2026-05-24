import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createOrderForCustomer } from "@/lib/orders";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const order = await createOrderForCustomer(user.id, await request.json());
    return NextResponse.json(order);
  } catch (error) {
    return jsonError(error);
  }
}
