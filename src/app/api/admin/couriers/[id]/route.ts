import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { removeCourierFromSystem } from "@/lib/admin";
import { requireApiUser } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser([Role.ADMIN]);
    const { id } = await params;
    const result = await removeCourierFromSystem(id);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
