import { NextResponse } from "next/server";
import { handleMaxWebhook } from "@/lib/messenger-bots";

export async function POST(request: Request) {
  const secret = process.env.MAX_WEBHOOK_SECRET?.trim();

  if (secret && request.headers.get("x-max-bot-api-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await handleMaxWebhook(await request.json());
  return NextResponse.json({ ok: true });
}
