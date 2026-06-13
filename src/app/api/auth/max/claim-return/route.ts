import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { claimMaxPhoneAuthReturn } from "@/lib/messenger-auth";

export async function POST(request: Request) {
  try {
    const result = await claimMaxPhoneAuthReturn(await request.json());
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
