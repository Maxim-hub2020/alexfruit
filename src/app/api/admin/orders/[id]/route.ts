import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getAdminOrder, updateOrderByAdmin } from "@/lib/orders";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser([Role.ADMIN]);
    const { id } = await params;
    const order = await getAdminOrder(id);
    return NextResponse.json(order);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser([Role.ADMIN]);
    const { id } = await params;
    const order = await updateOrderByAdmin(id, await request.json());
    return NextResponse.json(order);
  } catch (error) {
    return jsonError(error);
  }
}
