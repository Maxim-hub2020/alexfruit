import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { removeUnavailableOrderItemByCustomer } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const result = await removeUnavailableOrderItemByCustomer(
      user.id,
      id,
      await request.json(),
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
