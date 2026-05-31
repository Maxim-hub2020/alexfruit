import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getCustomerOrderCourierLocation } from "@/lib/courier-locations";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser([Role.CUSTOMER]);
    const { id } = await params;
    const location = await getCustomerOrderCourierLocation(user.id, id);

    return NextResponse.json(location);
  } catch (error) {
    return jsonError(error);
  }
}
