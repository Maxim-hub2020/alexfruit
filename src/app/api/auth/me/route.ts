import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { getCurrentUser, requireApiUser, updateCustomerProfile } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  });
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser([Role.CUSTOMER]);
    const updated = await updateCustomerProfile(user.id, await request.json());

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
