import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { loginAndCreateSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await loginAndCreateSession(await request.json());
    return NextResponse.json({
      id: user.id,
      role: user.role,
      name: user.name,
    });
  } catch (error) {
    return jsonError(error);
  }
}
