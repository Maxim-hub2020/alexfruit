import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { startMessengerPhoneAuth } from "@/lib/messenger-auth";

export async function POST(request: Request) {
  try {
    const challenge = await startMessengerPhoneAuth(await request.json());
    return NextResponse.json(challenge);
  } catch (error) {
    return jsonError(error);
  }
}
