import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import {
  applyCourierRedistribution,
  previewCourierRedistribution,
} from "@/lib/orders";

function getManualAssignments(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const details = item as {
        orderId?: unknown;
        courierId?: unknown;
        routeOrder?: unknown;
      };
      const orderId = typeof details.orderId === "string" ? details.orderId.trim() : "";
      const courierId =
        typeof details.courierId === "string" ? details.courierId.trim() : "";
      const routeOrder = Number(details.routeOrder);

      if (!orderId || !courierId) {
        return null;
      }

      return {
        orderId,
        courierId,
        routeOrder: Number.isInteger(routeOrder) && routeOrder > 0 ? routeOrder : 1,
      };
    })
    .filter((item): item is { orderId: string; courierId: string; routeOrder: number } =>
      Boolean(item),
    );
}

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

    const assignments = getManualAssignments(body.assignments);
    const proposal = body.commit
      ? await applyCourierRedistribution(date, assignments)
      : await previewCourierRedistribution(date);

    return NextResponse.json(proposal);
  } catch (error) {
    return jsonError(error);
  }
}
