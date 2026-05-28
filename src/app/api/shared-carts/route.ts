import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createSharedCart } from "@/lib/shared-carts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const sharedCart = await createSharedCart(user.id, await request.json());

    return NextResponse.json({
      id: sharedCart.id,
      token: sharedCart.token,
      title: sharedCart.title,
      url: `/shared-cart/${sharedCart.token}`,
      itemsCount: sharedCart.items.length,
    });
  } catch (error) {
    return jsonError(error);
  }
}
