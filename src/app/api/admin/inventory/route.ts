import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import {
  getDailyInventoryBoard,
  updateDailyInventoryBoard,
} from "@/lib/inventory";
import { dailyInventorySchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const url = new URL(request.url);
    const board = await getDailyInventoryBoard(url.searchParams.get("date"));

    return NextResponse.json(board);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const data = dailyInventorySchema.parse(await request.json());
    const board = await updateDailyInventoryBoard(data);

    return NextResponse.json(board);
  } catch (error) {
    return jsonError(error);
  }
}
