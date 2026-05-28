import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().url(),
  keys: z.object({
    p256dh: z.string().trim().min(1),
    auth: z.string().trim().min(1),
  }),
});

const deleteSubscriptionSchema = z.object({
  endpoint: z.string().trim().url(),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const subscription = pushSubscriptionSchema.parse(await request.json());
    const userAgent = request.headers.get("user-agent");

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId: user.id,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
      create: {
        userId: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const subscription = deleteSubscriptionSchema.parse(await request.json());

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: user.id,
        endpoint: subscription.endpoint,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
