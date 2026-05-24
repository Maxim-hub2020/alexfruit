import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { productSchema } from "@/lib/validators";
import { Role } from "@/generated/prisma";

export async function POST(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const data = productSchema.parse(await request.json());
    const product = await prisma.product.create({
      data: {
        ...data,
        description: data.description || null,
        imageUrl: data.imageUrl || null,
      },
    });
    return NextResponse.json(product);
  } catch (error) {
    return jsonError(error);
  }
}
