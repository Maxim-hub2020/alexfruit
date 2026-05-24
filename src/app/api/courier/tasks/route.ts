import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getCourierTasks } from "@/lib/orders";

export async function GET() {
  try {
    const user = await requireApiUser([Role.COURIER]);
    const tasks = await getCourierTasks(user.id);
    return NextResponse.json(tasks);
  } catch (error) {
    return jsonError(error);
  }
}
