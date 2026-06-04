import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getMessengerPhoneAuthStatus } from "@/lib/messenger-auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const status = await getMessengerPhoneAuthStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    return jsonError(error);
  }
}
