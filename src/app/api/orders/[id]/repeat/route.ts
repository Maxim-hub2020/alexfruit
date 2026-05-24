import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { repeatOrderItems } from "@/lib/orders";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const items = await repeatOrderItems(user.id, id);
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError(error);
  }
}
