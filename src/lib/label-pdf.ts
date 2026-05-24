import { access, readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, PDFFont, rgb } from "pdf-lib";
import { getAddressLabel } from "@/lib/utils";

const MM_TO_PT = 72 / 25.4;
const LABEL_WIDTH = 40 * MM_TO_PT;
const LABEL_HEIGHT = 50 * MM_TO_PT;
const LABEL_MARGIN = 6;

type LabelOrder = {
  orderNumber: string;
  user: {
    name: string;
    phone?: string | null;
  };
  address: {
    city: string;
    street: string;
    house: string;
    apartment?: string | null;
  };
  deliveryTimeSlot?: {
    title: string;
  } | null;
};

const regularFontCandidates = [
  process.env.LABEL_FONT_PATH,
  "C:\\Windows\\Fonts\\arial.ttf",
  "C:\\Windows\\Fonts\\Arial.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  path.join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"),
].filter(Boolean) as string[];

const boldFontCandidates = [
  process.env.LABEL_BOLD_FONT_PATH,
  "C:\\Windows\\Fonts\\arialbd.ttf",
  "C:\\Windows\\Fonts\\Arialbd.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
].filter(Boolean) as string[];

async function firstReadablePath(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known system font location.
    }
  }

  throw new Error(
    "Не найден TTF-шрифт для PDF-этикетки. Укажите путь в LABEL_FONT_PATH.",
  );
}

async function embedFont(pdfDoc: PDFDocument, candidates: string[]) {
  const fontPath = await firstReadablePath(candidates);
  const fontBytes = await readFile(fontPath);

  return pdfDoc.embedFont(fontBytes, { subset: true });
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function truncateLines(lines: string[], maxLines: number) {
  if (lines.length <= maxLines) {
    return lines;
  }

  return [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1]}...`];
}

function drawTextBlock({
  page,
  lines,
  x,
  y,
  font,
  size,
  lineHeight,
}: {
  page: PDFPage;
  lines: string[];
  x: number;
  y: number;
  font: PDFFont;
  size: number;
  lineHeight: number;
}) {
  let cursorY = y;

  for (const line of lines) {
    page.drawText(line, {
      x,
      y: cursorY,
      size,
      font,
      color: rgb(0.06, 0.08, 0.06),
    });
    cursorY -= lineHeight;
  }

  return cursorY;
}

function drawOrderLabelPage({
  pdfDoc,
  order,
  regularFont,
  boldFont,
}: {
  pdfDoc: PDFDocument;
  order: LabelOrder;
  regularFont: PDFFont;
  boldFont: PDFFont;
}) {
  const page = pdfDoc.addPage([LABEL_WIDTH, LABEL_HEIGHT]);
  const contentWidth = LABEL_WIDTH - LABEL_MARGIN * 2;
  const clientName = order.user.name.trim() || "Клиент";
  const address = getAddressLabel(order.address);
  const slotTitle = order.deliveryTimeSlot?.title ?? "время не указано";

  page.drawRectangle({
    x: 2,
    y: 2,
    width: LABEL_WIDTH - 4,
    height: LABEL_HEIGHT - 4,
    borderWidth: 0.7,
    borderColor: rgb(0.14, 0.45, 0.18),
  });

  page.drawText("АЛЕКСФРУТ", {
    x: LABEL_MARGIN,
    y: LABEL_HEIGHT - 13,
    size: 7,
    font: boldFont,
    color: rgb(0.14, 0.45, 0.18),
  });
  page.drawText(`Заказ ${order.orderNumber}`, {
    x: LABEL_MARGIN,
    y: LABEL_HEIGHT - 21,
    size: 5.2,
    font: regularFont,
    color: rgb(0.35, 0.42, 0.35),
  });

  page.drawLine({
    start: { x: LABEL_MARGIN, y: LABEL_HEIGHT - 27 },
    end: { x: LABEL_WIDTH - LABEL_MARGIN, y: LABEL_HEIGHT - 27 },
    thickness: 0.45,
    color: rgb(0.78, 0.86, 0.76),
  });

  page.drawText("КЛИЕНТ", {
    x: LABEL_MARGIN,
    y: LABEL_HEIGHT - 38,
    size: 4.8,
    font: boldFont,
    color: rgb(0.38, 0.47, 0.39),
  });

  const nameLines = truncateLines(wrapText(clientName, boldFont, 9.5, contentWidth), 2);
  let cursorY = drawTextBlock({
    page,
    lines: nameLines,
    x: LABEL_MARGIN,
    y: LABEL_HEIGHT - 49,
    font: boldFont,
    size: 9.5,
    lineHeight: 10.5,
  });

  cursorY -= 3;
  page.drawText("АДРЕС", {
    x: LABEL_MARGIN,
    y: cursorY,
    size: 4.8,
    font: boldFont,
    color: rgb(0.38, 0.47, 0.39),
  });
  cursorY -= 10;

  const addressLines = truncateLines(wrapText(address, regularFont, 6.8, contentWidth), 5);
  cursorY = drawTextBlock({
    page,
    lines: addressLines,
    x: LABEL_MARGIN,
    y: cursorY,
    font: regularFont,
    size: 6.8,
    lineHeight: 7.8,
  });

  const footerY = Math.max(8, cursorY - 4);
  page.drawText(`Окно: ${slotTitle}`, {
    x: LABEL_MARGIN,
    y: footerY,
    size: 5.3,
    font: boldFont,
    color: rgb(0.14, 0.45, 0.18),
  });

  return page;
}

export async function createOrdersLabelsPdf(orders: LabelOrder[]) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const regularFont = await embedFont(pdfDoc, regularFontCandidates);
  const boldFont = await embedFont(pdfDoc, boldFontCandidates).catch(() => regularFont);

  for (const order of orders) {
    drawOrderLabelPage({
      pdfDoc,
      order,
      regularFont,
      boldFont,
    });
  }

  return pdfDoc.save();
}

export async function createOrderLabelPdf(order: LabelOrder) {
  return createOrdersLabelsPdf([order]);
}
