import { Role } from "@/generated/prisma";
import { ApiError, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getOrdersForStaffPdf } from "@/lib/orders";
import { createCourierRoutePdf } from "@/lib/staff-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getDateParam(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date")?.trim();

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError("Выберите дату маршрута", 400);
  }

  return date;
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser([Role.COURIER]);
    const date = getDateParam(request);
    const orders = await getOrdersForStaffPdf({ date, courierId: user.id });

    if (orders.length === 0) {
      throw new ApiError("На выбранную дату нет заказов маршрута", 404);
    }

    const pdfBytes = await createCourierRoutePdf(orders, date, user.name);
    const pdfBody = new ArrayBuffer(pdfBytes.byteLength);

    new Uint8Array(pdfBody).set(pdfBytes);

    return new Response(pdfBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="alexfrut-my-route-${date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
