import { OrderStatus, Role } from "@/generated/prisma";
import { ApiError, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getOrdersForStaffPdf } from "@/lib/orders";
import { createCourierRoutePdf } from "@/lib/staff-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function requireDateParam(value: string | null | undefined) {
  const date = value?.trim();

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError("Выберите дату маршрута", 400);
  }

  return date;
}

function getRoutePdfParams(request: Request) {
  const { searchParams } = new URL(request.url);
  const beforeDate = searchParams.get("beforeDate")?.trim();

  if (beforeDate) {
    const normalizedBeforeDate = requireDateParam(beforeDate);

    return {
      filters: { beforeDate: normalizedBeforeDate },
      dateLabel: `до ${normalizedBeforeDate}`,
      fileDate: `before-${normalizedBeforeDate}`,
    };
  }

  const date = requireDateParam(searchParams.get("date"));

  return {
    filters: { date },
    dateLabel: date,
    fileDate: date,
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser([Role.COURIER]);
    const { filters, dateLabel, fileDate } = getRoutePdfParams(request);
    const orders = await getOrdersForStaffPdf({
      ...filters,
      courierId: user.id,
      statuses: [
        OrderStatus.HANDED_TO_COURIER,
        OrderStatus.COURIER_ON_THE_WAY,
        OrderStatus.DELIVERY_ISSUE,
      ],
    });

    if (orders.length === 0) {
      throw new ApiError("На выбранную дату нет заказов маршрута", 404);
    }

    const pdfBytes = await createCourierRoutePdf(orders, dateLabel, user.name);
    const pdfBody = new ArrayBuffer(pdfBytes.byteLength);

    new Uint8Array(pdfBody).set(pdfBytes);

    return new Response(pdfBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="alexfrut-my-route-${fileDate}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
