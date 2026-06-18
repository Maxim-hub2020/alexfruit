import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  createOrderLabelPdf,
  createOrdersLabelsPdf,
  LABEL_PDF_PRESET,
} from "@/lib/label-pdf";

const baseOrder = {
  orderNumber: "1042",
  user: {
    name: "Елена Соколова",
    phone: "+79380001100",
  },
  address: {
    city: "Ростов-на-Дону",
    street: "Пушкинская",
    house: "104",
    apartment: "18",
  },
  deliveryTimeSlot: {
    title: "09:00-12:00",
  },
};

test("creates CT221B-BLH2.0 compatible single label PDF", async () => {
  const pdfBytes = await createOrderLabelPdf(baseOrder);
  const pdf = await PDFDocument.load(pdfBytes);
  const [page] = pdf.getPages();
  const size = page.getSize();
  const mmToPt = 72 / 25.4;

  assert.equal(pdf.getPageCount(), 1);
  assert.equal(Math.round(size.width), Math.round(LABEL_PDF_PRESET.widthMm * mmToPt));
  assert.equal(Math.round(size.height), Math.round(LABEL_PDF_PRESET.heightMm * mmToPt));
});

test("creates separate shared-cart participant labels", async () => {
  const pdfBytes = await createOrdersLabelsPdf([
    {
      ...baseOrder,
      sharedCart: {
        items: [
          {
            addedById: "customer-1",
            addedBy: {
              id: "customer-1",
              name: "Елена Соколова",
              phone: "+79380001100",
            },
          },
          {
            addedById: "customer-2",
            addedBy: {
              id: "customer-2",
              name: "Антон Иванов",
              phone: "+79380002200",
            },
          },
        ],
      },
    },
  ]);
  const pdf = await PDFDocument.load(pdfBytes);

  assert.equal(pdf.getPageCount(), 2);
});
