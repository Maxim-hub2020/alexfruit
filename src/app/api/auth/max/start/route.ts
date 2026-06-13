import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { startMaxPhoneAuth } from "@/lib/messenger-auth";

export async function POST(request: Request) {
  try {
    const challenge = await startMaxPhoneAuth(await request.json());
    return NextResponse.json(challenge);
  } catch (error) {
    return jsonError(error);
  }
}
