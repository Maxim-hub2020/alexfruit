import { Role } from "@/generated/prisma";
import { ApiError, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getOrdersForStaffPdf } from "@/lib/orders";
import { createCourierRoutePdf } from "@/lib/staff-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getRouteParams(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date")?.trim();
  const courierId = searchParams.get("courierId")?.trim();

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError("Выберите дату маршрута", 400);
  }

  if (!courierId) {
    throw new ApiError("Выберите курьера для маршрута", 400);
  }

  return { date, courierId };
}

export async function GET(request: Request) {
  try {
    await requireApiUser([Role.ADMIN]);
    const { date, courierId } = getRouteParams(request);
    const orders = await getOrdersForStaffPdf({ date, courierId });

    if (orders.length === 0) {
      throw new ApiError("На выбранную дату у курьера нет заказов", 404);
    }

    const courierName = orders[0]?.courier?.name;
    const pdfBytes = await createCourierRoutePdf(orders, date, courierName);
    const pdfBody = new ArrayBuffer(pdfBytes.byteLength);

    new Uint8Array(pdfBody).set(pdfBytes);

    return new Response(pdfBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="alexfrut-route-${date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
