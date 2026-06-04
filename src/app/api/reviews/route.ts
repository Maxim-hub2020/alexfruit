import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createProductReview } from "@/lib/reviews";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser([Role.CUSTOMER]);
    const review = await createProductReview(user.id, await request.json());
    return NextResponse.json(review);
  } catch (error) {
    return jsonError(error);
  }
}
