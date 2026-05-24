import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { removeAddressForUser, saveAddressForUser } from "@/lib/addresses";
import { requireApiUser } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const address = await saveAddressForUser(user.id, await request.json(), id);
    return NextResponse.json(address);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    await removeAddressForUser(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
