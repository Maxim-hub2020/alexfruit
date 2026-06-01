import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import {
  applyCourierRedistribution,
  previewCourierRedistribution,
} from "@/lib/orders";

export async function POST(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const body = await request.json();
    const date =
      typeof body.date === "string" ? body.date.trim().slice(0, 10) : "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Выберите дату доставки для перераспределения" },
        { status: 400 },
      );
    }

    const proposal = body.commit
      ? await applyCourierRedistribution(date)
      : await previewCourierRedistribution(date);

    return NextResponse.json(proposal);
  } catch (error) {
    return jsonError(error);
  }
}
