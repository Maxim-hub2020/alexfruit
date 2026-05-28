import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import {
  deleteSharedCartItem,
  updateSharedCartItem,
} from "@/lib/shared-carts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string; itemId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { token, itemId } = await params;
    const item = await updateSharedCartItem(token, itemId, user, await request.json());

    return NextResponse.json(item);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ token: string; itemId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { token, itemId } = await params;
    const result = await deleteSharedCartItem(token, itemId, user);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
