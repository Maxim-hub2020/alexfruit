import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { addSharedCartItem } from "@/lib/shared-carts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const user = await requireApiUser();
    const { token } = await params;
    const item = await addSharedCartItem(token, user.id, await request.json());

    return NextResponse.json(item);
  } catch (error) {
    return jsonError(error);
  }
}
