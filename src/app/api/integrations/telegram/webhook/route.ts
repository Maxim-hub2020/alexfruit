import { NextResponse } from "next/server";
import { handleTelegramWebhook } from "@/lib/messenger-bots";

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (
    secret &&
    request.headers.get("x-telegram-bot-api-secret-token") !== secret
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = await handleTelegramWebhook(await request.json());

  return NextResponse.json(response ?? { ok: true });
}
