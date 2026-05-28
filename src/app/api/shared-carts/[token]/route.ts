import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { deleteSharedCart } from "@/lib/shared-carts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const user = await requireApiUser();
    const { token } = await params;
    const result = await deleteSharedCart(token, user);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
