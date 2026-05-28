import { Role } from "@/generated/prisma";
import { ApiError, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { canPrintOrderLabelStatus } from "@/lib/constants";
import { createOrderLabelPdf } from "@/lib/label-pdf";
import { getAdminOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser([Role.ADMIN]);
    const { id } = await params;
    const order = await getAdminOrder(id);

    if (!canPrintOrderLabelStatus(order.status)) {
      throw new ApiError(
        "Этикетка доступна только после подтверждения заказа.",
        409,
      );
    }

    const pdfBytes = await createOrderLabelPdf(order);
    const pdfBody = new ArrayBuffer(pdfBytes.byteLength);

    new Uint8Array(pdfBody).set(pdfBytes);

    return new Response(pdfBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${order.orderNumber}-label-40x50.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
