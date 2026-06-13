import { NextResponse } from "next/server";
import { ApiError, jsonError } from "@/lib/api";
import { getMaxPhoneAuthStatus } from "@/lib/messenger-auth";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state")?.trim();

    if (!state) {
      throw new ApiError("Не найден код подтверждения", 400);
    }

    const status = await getMaxPhoneAuthStatus(state);
    return NextResponse.json(status);
  } catch (error) {
    return jsonError(error);
  }
}
