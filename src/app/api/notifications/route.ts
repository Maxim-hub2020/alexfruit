import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function clampLimit(value: string | null) {
  const limit = Number(value ?? 12);

  if (!Number.isFinite(limit)) {
    return 12;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 20);
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const limit = clampLimit(searchParams.get("limit"));

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        orderId: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        ...notification,
        createdAt: notification.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
