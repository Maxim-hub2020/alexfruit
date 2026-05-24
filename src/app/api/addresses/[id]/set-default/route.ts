import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { setDefaultAddress } from "@/lib/addresses";
import { requireApiUser } from "@/lib/auth";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    await setDefaultAddress(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
