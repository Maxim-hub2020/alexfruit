import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { reportCourierProblem } from "@/lib/orders";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser([Role.COURIER]);
    const { id } = await params;
    const order = await reportCourierProblem(id, user.id, await request.json());
    return NextResponse.json(order);
  } catch (error) {
    return jsonError(error);
  }
}
