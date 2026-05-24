import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { categorySchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const data = categorySchema.parse(await request.json());
    const category = await prisma.category.create({
      data,
    });
    return NextResponse.json(category);
  } catch (error) {
    return jsonError(error);
  }
}
