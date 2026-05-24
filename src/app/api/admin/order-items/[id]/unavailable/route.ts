import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { markOrderItemUnavailable } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser([Role.ADMIN]);
    const { id } = await params;
    const result = await markOrderItemUnavailable(id);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
