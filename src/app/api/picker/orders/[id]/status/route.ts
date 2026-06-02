import { NextResponse } from "next/server";
import { OrderStatus, Role } from "@/generated/prisma";
import { ApiError, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { updateOrderStatusByAdmin } from "@/lib/orders";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser([Role.PICKER]);
    const body = await request.json();

    if (body?.status !== OrderStatus.ASSEMBLED) {
      throw new ApiError("Сборщик может только передать заказ после сборки", 403);
    }

    const { id } = await params;
    const order = await updateOrderStatusByAdmin(id, {
      status: OrderStatus.ASSEMBLED,
    });

    return NextResponse.json(order);
  } catch (error) {
    return jsonError(error);
  }
}
