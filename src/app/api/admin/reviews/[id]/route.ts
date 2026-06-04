import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { updateProductReviewByAdmin } from "@/lib/reviews";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser([Role.ADMIN]);
    const { id } = await context.params;
    const review = await updateProductReviewByAdmin(
      user.id,
      id,
      await request.json(),
    );
    return NextResponse.json(review);
  } catch (error) {
    return jsonError(error);
  }
}
