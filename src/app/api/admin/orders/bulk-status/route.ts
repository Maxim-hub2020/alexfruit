import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { updateOrderStatusesByAdmin } from "@/lib/orders";

export async function PATCH(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const result = await updateOrderStatusesByAdmin(await request.json());
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
