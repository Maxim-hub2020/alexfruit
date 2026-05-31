import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getAdminCourierLocations } from "@/lib/courier-locations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiUser([Role.ADMIN]);
    const couriers = await getAdminCourierLocations();

    return NextResponse.json({ couriers });
  } catch (error) {
    return jsonError(error);
  }
}
