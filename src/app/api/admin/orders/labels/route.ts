import { Role } from "@/generated/prisma";
import { ApiError, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createOrdersLabelsPdf, LABEL_PDF_PRESET } from "@/lib/label-pdf";
import { getOrdersForLabels } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getDateParam(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date")?.trim();

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError("Выберите дату доставки для формирования этикеток", 400);
  }

  return date;
}

export async function GET(request: Request) {
  try {
    await requireApiUser([Role.ADMIN, Role.PICKER]);
    const date = getDateParam(request);
    const orders = await getOrdersForLabels({ date });

    if (orders.length === 0) {
      throw new ApiError(
        "На выбранную дату нет подтверждённых заказов для этикеток",
        404,
      );
    }

    const pdfBytes = await createOrdersLabelsPdf(orders);
    const pdfBody = new ArrayBuffer(pdfBytes.byteLength);

    new Uint8Array(pdfBody).set(pdfBytes);

    const filename = `alexfrut-labels-${date}-${LABEL_PDF_PRESET.fileSuffix}.pdf`;

    return new Response(pdfBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
