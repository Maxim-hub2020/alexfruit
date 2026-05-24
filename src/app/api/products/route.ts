import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(products);
  } catch (error) {
    return jsonError(error);
  }
}
