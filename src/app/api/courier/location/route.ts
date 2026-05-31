import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getCourierLocation, updateCourierLocation } from "@/lib/courier-locations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser([Role.COURIER]);
    const location = await getCourierLocation(user.id);

    return NextResponse.json({ location });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser([Role.COURIER]);
    const location = await updateCourierLocation(user.id, await request.json());

    return NextResponse.json({
      ok: true,
      location: {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        accuracy: location.accuracy === null ? null : Number(location.accuracy),
        updatedAt: location.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
