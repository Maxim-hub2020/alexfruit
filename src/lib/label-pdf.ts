import { access, readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, PDFFont, rgb } from "pdf-lib";
import { getAddressLabel } from "@/lib/utils";

const MM_TO_PT = 72 / 25.4;

export const LABEL_PDF_PRESET = {
  printerModel: "CT221B-BLH2.0",
  widthMm: 40,
  heightMm: 50,
  fileSuffix: "ct221b-40x50",
} as const;

const LABEL_WIDTH = LABEL_PDF_PRESET.widthMm * MM_TO_PT;
const LABEL_HEIGHT = LABEL_PDF_PRESET.heightMm * MM_TO_PT;
const LABEL_MARGIN = 4.5;
const BORDER_INSET = 1.8;
const PRINT_BLACK = rgb(0, 0, 0);
const SOFT_BLACK = rgb(0.08, 0.09, 0.08);
const THERMAL_BOLD_OFFSET = 0.13;

type LabelOrder = {
  orderNumber: string;
  needsLift?: boolean;
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
  sharedCart?: {
    items?: Array<{
      addedById: string;
      addedBy: {
        id: string;
        name: string;
        phone?: string | null;
      };
    }>;
  } | null;
};

type LabelOptions = {
  participantId?: string | null;
};

const regularFontCandidates = [
  process.env.LABEL_FONT_PATH,
  "C:\\Windows\\Fonts\\verdana.ttf",
  "C:\\Windows\\Fonts\\Verdana.ttf",
  "C:\\Windows\\Fonts\\arial.ttf",
  "C:\\Windows\\Fonts\\Arial.ttf",
  "/usr/share/fonts/dejavu/DejaVuSansCondensed.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
].filter(Boolean) as string[];

const boldFontCandidates = [
  process.env.LABEL_BOLD_FONT_PATH,
  "C:\\Windows\\Fonts\\verdanab.ttf",
  "C:\\Windows\\Fonts\\Verdanab.ttf",
  "C:\\Windows\\Fonts\\arialbd.ttf",
  "C:\\Windows\\Fonts\\Arialbd.ttf",
  "/usr/share/fonts/dejavu/DejaVuSansCondensed-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
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

function drawThermalText({
  page,
  text,
  x,
  y,
  font,
  size,
  color = PRINT_BLACK,
  strengthen = false,
}: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  font: PDFFont;
  size: number;
  color?: ReturnType<typeof rgb>;
  strengthen?: boolean;
}) {
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
  });

  if (strengthen) {
    page.drawText(text, {
      x: x + THERMAL_BOLD_OFFSET,
      y,
      size,
      font,
      color,
    });
  }
}

function drawTextBlock({
  page,
  lines,
  x,
  y,
  font,
  size,
  lineHeight,
  color = PRINT_BLACK,
  strengthen = false,
}: {
  page: PDFPage;
  lines: string[];
  x: number;
  y: number;
  font: PDFFont;
  size: number;
  lineHeight: number;
  color?: ReturnType<typeof rgb>;
  strengthen?: boolean;
}) {
  let cursorY = y;

  for (const line of lines) {
    drawThermalText({
      page,
      text: line,
      x,
      y: cursorY,
      size,
      font,
      color,
      strengthen,
    });
    cursorY -= lineHeight;
  }

  return cursorY;
}

function drawOrderLabelPage({
  pdfDoc,
  order,
  boldFont,
}: {
  pdfDoc: PDFDocument;
  order: LabelOrder;
  boldFont: PDFFont;
}) {
  const page = pdfDoc.addPage([LABEL_WIDTH, LABEL_HEIGHT]);
  const contentWidth = LABEL_WIDTH - LABEL_MARGIN * 2;
  const clientName = order.user.name.trim() || "Клиент";
  const address = `${getAddressLabel(order.address)}${
    order.needsLift ? " · подъём до двери" : ""
  }`;
  const slotTitle = order.deliveryTimeSlot?.title ?? "время не указано";

  page.drawRectangle({
    x: BORDER_INSET,
    y: BORDER_INSET,
    width: LABEL_WIDTH - BORDER_INSET * 2,
    height: LABEL_HEIGHT - BORDER_INSET * 2,
    borderWidth: 1.1,
    borderColor: PRINT_BLACK,
  });

  drawThermalText({
    page,
    text: "АЛЕКСФРУТ",
    x: LABEL_MARGIN,
    y: LABEL_HEIGHT - 13.5,
    size: 8.6,
    font: boldFont,
    color: PRINT_BLACK,
    strengthen: true,
  });
  drawThermalText({
    page,
    text: `Заказ ${order.orderNumber}`,
    x: LABEL_MARGIN,
    y: LABEL_HEIGHT - 24.5,
    size: 6.7,
    font: boldFont,
    color: SOFT_BLACK,
    strengthen: true,
  });

  page.drawLine({
    start: { x: LABEL_MARGIN, y: LABEL_HEIGHT - 31 },
    end: { x: LABEL_WIDTH - LABEL_MARGIN, y: LABEL_HEIGHT - 31 },
    thickness: 0.75,
    color: PRINT_BLACK,
  });

  drawThermalText({
    page,
    text: "КЛИЕНТ",
    x: LABEL_MARGIN,
    y: LABEL_HEIGHT - 42,
    size: 5.8,
    font: boldFont,
    color: PRINT_BLACK,
    strengthen: true,
  });

  const nameSize = 12.1;
  const nameLines = truncateLines(wrapText(clientName, boldFont, nameSize, contentWidth), 2);
  let cursorY = drawTextBlock({
    page,
    lines: nameLines,
    x: LABEL_MARGIN,
    y: LABEL_HEIGHT - 55,
    font: boldFont,
    size: nameSize,
    lineHeight: 13.2,
    strengthen: true,
  });

  cursorY -= 4;
  drawThermalText({
    page,
    text: "АДРЕС",
    x: LABEL_MARGIN,
    y: cursorY,
    size: 5.8,
    font: boldFont,
    color: PRINT_BLACK,
    strengthen: true,
  });
  cursorY -= 11.5;

  const addressSize = 8.7;
  const addressLineHeight = 9.9;
  const footerY = 8.5;
  const maxAddressLines = Math.max(
    2,
    Math.min(4, Math.floor((cursorY - footerY - 13) / addressLineHeight)),
  );
  const addressLines = truncateLines(wrapText(address, boldFont, addressSize, contentWidth), maxAddressLines);
  cursorY = drawTextBlock({
    page,
    lines: addressLines,
    x: LABEL_MARGIN,
    y: cursorY,
    font: boldFont,
    size: addressSize,
    lineHeight: addressLineHeight,
    strengthen: true,
  });

  page.drawLine({
    start: { x: LABEL_MARGIN, y: footerY + 10 },
    end: { x: LABEL_WIDTH - LABEL_MARGIN, y: footerY + 10 },
    thickness: 0.65,
    color: PRINT_BLACK,
  });

  drawThermalText({
    page,
    text: `Окно: ${slotTitle}`,
    x: LABEL_MARGIN,
    y: footerY,
    size: 6.7,
    font: boldFont,
    color: PRINT_BLACK,
    strengthen: true,
  });

  return page;
}

function uniqueParticipantLabels(order: LabelOrder, options: LabelOptions = {}) {
  const participantItems = order.sharedCart?.items ?? [];

  if (participantItems.length === 0) {
    return [order];
  }

  const participants = new Map<
    string,
    {
      id: string;
      name: string;
      phone?: string | null;
    }
  >();

  for (const item of participantItems) {
    if (options.participantId && item.addedById !== options.participantId) {
      continue;
    }

    participants.set(item.addedById, item.addedBy);
  }

  if (participants.size === 0) {
    return [order];
  }

  return [...participants.values()].map((participant) => ({
    ...order,
    user: {
      name: participant.name,
      phone: participant.phone,
    },
  }));
}

export async function createOrdersLabelsPdf(
  orders: LabelOrder[],
  options: LabelOptions = {},
) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle(
    `AlexFruit labels ${LABEL_PDF_PRESET.printerModel} ${LABEL_PDF_PRESET.widthMm}x${LABEL_PDF_PRESET.heightMm}mm`,
  );
  pdfDoc.setCreator("AlexFruit");
  pdfDoc.setProducer(`AlexFruit label preset ${LABEL_PDF_PRESET.printerModel}`);

  const fallbackFont = await embedFont(pdfDoc, regularFontCandidates);
  const boldFont = await embedFont(pdfDoc, boldFontCandidates).catch(() => fallbackFont);

  for (const order of orders) {
    for (const labelOrder of uniqueParticipantLabels(order, options)) {
      drawOrderLabelPage({
        pdfDoc,
        order: labelOrder,
        boldFont,
      });
    }
  }

  return pdfDoc.save();
}

export async function createOrderLabelPdf(
  order: LabelOrder,
  options: LabelOptions = {},
) {
  return createOrdersLabelsPdf([order], options);
}
