import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getWebPushPublicKey, isWebPushConfigured } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiUser();

    return NextResponse.json({
      enabled: isWebPushConfigured(),
      publicKey: getWebPushPublicKey(),
    });
  } catch (error) {
    return jsonError(error);
  }
}
