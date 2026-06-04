import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { addDailyAvailabilityToProducts } from "@/lib/inventory";
import { addReviewSummaryToProducts } from "@/lib/reviews";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
    const productsWithAvailability = await addReviewSummaryToProducts(
      await addDailyAvailabilityToProducts(
        products,
        url.searchParams.get("date"),
      ),
    );

    return NextResponse.json(productsWithAvailability);
  } catch (error) {
    return jsonError(error);
  }
}
