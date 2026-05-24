import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { categorySchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser([Role.ADMIN]);
    const { id } = await params;
    const data = categorySchema.partial().parse(await request.json());
    const category = await prisma.category.update({
      where: { id },
      data,
    });
    return NextResponse.json(category);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser([Role.ADMIN]);
    const { id } = await params;
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
