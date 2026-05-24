import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { createCourier } from "@/lib/admin";
import { requireApiUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const courier = await createCourier(await request.json());
    return NextResponse.json(courier);
  } catch (error) {
    return jsonError(error);
  }
}
