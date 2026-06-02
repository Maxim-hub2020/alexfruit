import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { createPicker } from "@/lib/admin";
import { requireApiUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const picker = await createPicker(await request.json());
    return NextResponse.json(picker);
  } catch (error) {
    return jsonError(error);
  }
}
