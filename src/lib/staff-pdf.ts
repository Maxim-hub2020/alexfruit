import { access, readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, PDFFont, rgb } from "pdf-lib";
import { APP_NAME, unitLabels } from "@/lib/constants";
import { formatCurrency, getAddressLabel } from "@/lib/utils";
import { buildYandexRouteUrl, routePointFromAddress } from "@/lib/yandex-routes";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 36;
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;

type PrintableValue = number | string | { toString(): string } | null | undefined;

type StaffPdfOrder = {
  orderNumber: string;
  status: string;
  preliminaryTotal: PrintableValue;
  finalTotal?: PrintableValue;
  needsLift?: boolean;
  customerComment?: string | null;
  adminComment?: string | null;
  user: {
    name: string;
    phone?: string | null;
  };
  address: {
    city: string;
    street: string;
    house: string;
    apartment?: string | null;
    latitude?: PrintableValue;
    longitude?: PrintableValue;
  };
  deliveryTimeSlot?: {
    title: string;
  } | null;
  courier?: {
    name?: string | null;
    phone?: string | null;
  } | null;
  deliveryTask?: {
    routeOrder?: number | null;
    status?: string | null;
  } | null;
  items?: Array<{
    productName: string;
    unit: string;
    orderedQuantity: PrintableValue;
    actualQuantity?: PrintableValue;
  }>;
};

function sortOrdersByRoute(orders: StaffPdfOrder[]) {
  return orders.toSorted((first, second) => {
    const firstRouteOrder = first.deliveryTask?.routeOrder ?? 999;
    const secondRouteOrder = second.deliveryTask?.routeOrder ?? 999;

    return (
      firstRouteOrder - secondRouteOrder ||
      (first.deliveryTimeSlot?.title ?? "").localeCompare(
        second.deliveryTimeSlot?.title ?? "",
        "ru",
      ) ||
      first.orderNumber.localeCompare(second.orderNumber, "ru")
    );
  });
}

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
      // Keep trying known system fonts.
    }
  }

  throw new Error("Не найден TTF-шрифт для PDF. Укажите путь в LABEL_FONT_PATH.");
}

async function embedFont(pdfDoc: PDFDocument, candidates: string[]) {
  const fontPath = await firstReadablePath(candidates);
  const fontBytes = await readFile(fontPath);

  return pdfDoc.embedFont(fontBytes, { subset: true });
}

function valueToNumber(value: PrintableValue) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatQuantity(value: PrintableValue, unit: string) {
  const number = valueToNumber(value);
  const formatted = Number.isInteger(number)
    ? String(number)
    : number.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

  return `${formatted} ${unitLabels[unit] ?? unit}`;
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0.08, 0.1, 0.08),
) {
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
  });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawWrappedText({
  page,
  text,
  x,
  y,
  maxWidth,
  font,
  size,
  lineHeight,
  color = rgb(0.08, 0.1, 0.08),
}: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: PDFFont;
  size: number;
  lineHeight: number;
  color?: ReturnType<typeof rgb>;
}) {
  let cursorY = y;

  for (const line of wrapText(text, font, size, maxWidth)) {
    drawText(page, line, x, cursorY, font, size, color);
    cursorY -= lineHeight;
  }

  return cursorY;
}

function drawHeader({
  page,
  title,
  date,
  count,
  regularFont,
  boldFont,
}: {
  page: PDFPage;
  title: string;
  date: string;
  count: number;
  regularFont: PDFFont;
  boldFont: PDFFont;
}) {
  drawText(page, APP_NAME.toUpperCase(), PAGE_MARGIN, A4_HEIGHT - 50, boldFont, 10, rgb(0.14, 0.45, 0.18));
  drawText(page, title, PAGE_MARGIN, A4_HEIGHT - 74, boldFont, 20);
  drawText(
    page,
    `Дата доставки: ${date} · Заказов: ${count}`,
    PAGE_MARGIN,
    A4_HEIGHT - 95,
    regularFont,
    10,
    rgb(0.38, 0.45, 0.38),
  );
  page.drawLine({
    start: { x: PAGE_MARGIN, y: A4_HEIGHT - 112 },
    end: { x: A4_WIDTH - PAGE_MARGIN, y: A4_HEIGHT - 112 },
    thickness: 0.6,
    color: rgb(0.78, 0.86, 0.76),
  });

  return A4_HEIGHT - 134;
}

function drawFooter(page: PDFPage, pageNumber: number, regularFont: PDFFont) {
  drawText(
    page,
    `${APP_NAME} · страница ${pageNumber}`,
    PAGE_MARGIN,
    22,
    regularFont,
    8,
    rgb(0.5, 0.56, 0.5),
  );
}

async function createBasePdf() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const regularFont = await embedFont(pdfDoc, regularFontCandidates);
  const boldFont = await embedFont(pdfDoc, boldFontCandidates).catch(() => regularFont);

  return { pdfDoc, regularFont, boldFont };
}

export async function createAssemblyPdf(orders: StaffPdfOrder[], date: string) {
  const { pdfDoc, regularFont, boldFont } = await createBasePdf();
  let pageNumber = 1;
  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = drawHeader({
    page,
    title: "Лист сборки заказов",
    date,
    count: orders.length,
    regularFont,
    boldFont,
  });

  drawFooter(page, pageNumber, regularFont);

  function nextPage() {
    pageNumber += 1;
    page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    y = drawHeader({
      page,
      title: "Лист сборки заказов",
      date,
      count: orders.length,
      regularFont,
      boldFont,
    });
    drawFooter(page, pageNumber, regularFont);
  }

  function ensureSpace(height: number) {
    if (y - height < 56) {
      nextPage();
    }
  }

  orders.forEach((order, orderIndex) => {
    ensureSpace(155);

    const slot = order.deliveryTimeSlot?.title ?? "слот не указан";
    const address = `${getAddressLabel(order.address)}${
      order.needsLift ? " · подъём до двери" : ""
    }`;
    const comments = [order.customerComment, order.adminComment]
      .map((comment) => comment?.trim())
      .filter(Boolean)
      .join(" · ");

    page.drawRectangle({
      x: PAGE_MARGIN,
      y: y - 30,
      width: CONTENT_WIDTH,
      height: 30,
      color: rgb(0.93, 0.97, 0.91),
      borderColor: rgb(0.78, 0.86, 0.76),
      borderWidth: 0.5,
    });
    drawText(
      page,
      `${orderIndex + 1}. ${order.orderNumber} · ${slot}`,
      PAGE_MARGIN + 12,
      y - 20,
      boldFont,
      12,
      rgb(0.1, 0.29, 0.12),
    );
    y -= 48;

    y = drawWrappedText({
      page,
      text: `Клиент: ${order.user.name} · ${order.user.phone ?? "телефон не указан"}`,
      x: PAGE_MARGIN,
      y,
      maxWidth: CONTENT_WIDTH,
      font: regularFont,
      size: 10,
      lineHeight: 13,
    });
    y = drawWrappedText({
      page,
      text: `Адрес: ${address}`,
      x: PAGE_MARGIN,
      y,
      maxWidth: CONTENT_WIDTH,
      font: regularFont,
      size: 10,
      lineHeight: 13,
    });

    if (comments) {
      y = drawWrappedText({
        page,
        text: `Комментарий: ${comments}`,
        x: PAGE_MARGIN,
        y,
        maxWidth: CONTENT_WIDTH,
        font: regularFont,
        size: 9,
        lineHeight: 12,
        color: rgb(0.42, 0.35, 0.2),
      });
    }

    y -= 8;
    drawText(page, "Товар", PAGE_MARGIN, y, boldFont, 9, rgb(0.38, 0.45, 0.38));
    drawText(page, "Заказано", PAGE_MARGIN + 300, y, boldFont, 9, rgb(0.38, 0.45, 0.38));
    drawText(page, "Факт", PAGE_MARGIN + 405, y, boldFont, 9, rgb(0.38, 0.45, 0.38));
    y -= 8;
    page.drawLine({
      start: { x: PAGE_MARGIN, y },
      end: { x: A4_WIDTH - PAGE_MARGIN, y },
      thickness: 0.4,
      color: rgb(0.82, 0.88, 0.8),
    });
    y -= 16;

    for (const item of order.items ?? []) {
      ensureSpace(34);
      const itemY = y;
      y = drawWrappedText({
        page,
        text: item.productName,
        x: PAGE_MARGIN,
        y,
        maxWidth: 280,
        font: regularFont,
        size: 10,
        lineHeight: 12,
      });
      drawText(
        page,
        formatQuantity(item.orderedQuantity, item.unit),
        PAGE_MARGIN + 300,
        itemY,
        regularFont,
        10,
      );
      drawText(page, "__________", PAGE_MARGIN + 405, itemY, regularFont, 10);
      y = Math.min(y, itemY - 18);
    }

    y -= 10;
    drawText(
      page,
      `Предварительно: ${formatCurrency(valueToNumber(order.preliminaryTotal))}`,
      PAGE_MARGIN,
      y,
      boldFont,
      10,
      rgb(0.14, 0.45, 0.18),
    );
    y -= 28;
  });

  return pdfDoc.save();
}

export async function createDeliveryPdf(orders: StaffPdfOrder[], date: string) {
  const { pdfDoc, regularFont, boldFont } = await createBasePdf();
  let pageNumber = 1;
  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = drawHeader({
    page,
    title: "Маршрутный лист доставщика",
    date,
    count: orders.length,
    regularFont,
    boldFont,
  });

  drawFooter(page, pageNumber, regularFont);

  function nextPage() {
    pageNumber += 1;
    page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    y = drawHeader({
      page,
      title: "Маршрутный лист доставщика",
      date,
      count: orders.length,
      regularFont,
      boldFont,
    });
    drawFooter(page, pageNumber, regularFont);
  }

  function ensureSpace(height: number) {
    if (y - height < 56) {
      nextPage();
    }
  }

  orders.forEach((order, index) => {
    ensureSpace(96);

    const slot = order.deliveryTimeSlot?.title ?? "слот не указан";
    const address = `${getAddressLabel(order.address)}${
      order.needsLift ? " · подъём до двери" : ""
    }`;
    const courier = order.courier?.name?.trim() || "курьер не назначен";
    const amount = formatCurrency(
      valueToNumber(order.finalTotal ?? order.preliminaryTotal),
    );

    page.drawRectangle({
      x: PAGE_MARGIN,
      y: y - 76,
      width: CONTENT_WIDTH,
      height: 82,
      color: index % 2 === 0 ? rgb(0.98, 1, 0.97) : rgb(1, 1, 1),
      borderColor: rgb(0.83, 0.9, 0.82),
      borderWidth: 0.5,
    });

    drawText(
      page,
      `${index + 1}. ${slot} · ${order.orderNumber}`,
      PAGE_MARGIN + 12,
      y - 13,
      boldFont,
      12,
      rgb(0.1, 0.29, 0.12),
    );
    drawText(
      page,
      amount,
      A4_WIDTH - PAGE_MARGIN - 92,
      y - 13,
      boldFont,
      11,
      rgb(0.14, 0.45, 0.18),
    );
    y -= 31;
    y = drawWrappedText({
      page,
      text: `Адрес: ${address}`,
      x: PAGE_MARGIN + 12,
      y,
      maxWidth: CONTENT_WIDTH - 24,
      font: regularFont,
      size: 10,
      lineHeight: 12,
    });
    y = drawWrappedText({
      page,
      text: `Клиент: ${order.user.name} · ${order.user.phone ?? "телефон не указан"} · ${courier}`,
      x: PAGE_MARGIN + 12,
      y,
      maxWidth: CONTENT_WIDTH - 24,
      font: regularFont,
      size: 9,
      lineHeight: 11,
      color: rgb(0.38, 0.45, 0.38),
    });

    if (order.customerComment) {
      y = drawWrappedText({
        page,
        text: `Комментарий: ${order.customerComment}`,
        x: PAGE_MARGIN + 12,
        y,
        maxWidth: CONTENT_WIDTH - 24,
        font: regularFont,
        size: 8,
        lineHeight: 10,
        color: rgb(0.42, 0.35, 0.2),
      });
    }

    y -= 18;
  });

  return pdfDoc.save();
}

export async function createCourierRoutePdf(
  orders: StaffPdfOrder[],
  date: string,
  courierName?: string | null,
) {
  const routeOrders = sortOrdersByRoute(orders);
  const routeUrl = buildYandexRouteUrl(
    routeOrders.map((order) => routePointFromAddress(order.address)),
    { includeStart: true },
  );
  const { pdfDoc, regularFont, boldFont } = await createBasePdf();
  let pageNumber = 1;
  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = drawHeader({
    page,
    title: "Маршрут курьера",
    date,
    count: routeOrders.length,
    regularFont,
    boldFont,
  });

  drawFooter(page, pageNumber, regularFont);

  function nextPage() {
    pageNumber += 1;
    page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    y = drawHeader({
      page,
      title: "Маршрут курьера",
      date,
      count: routeOrders.length,
      regularFont,
      boldFont,
    });
    drawFooter(page, pageNumber, regularFont);
  }

  function ensureSpace(height: number) {
    if (y - height < 56) {
      nextPage();
    }
  }

  y = drawWrappedText({
    page,
    text: `Курьер: ${courierName?.trim() || routeOrders[0]?.courier?.name || "не назначен"}`,
    x: PAGE_MARGIN,
    y,
    maxWidth: CONTENT_WIDTH,
    font: boldFont,
    size: 12,
    lineHeight: 15,
    color: rgb(0.1, 0.29, 0.12),
  });
  y = drawWrappedText({
    page,
    text: `Яндекс маршрут: ${routeUrl}`,
    x: PAGE_MARGIN,
    y,
    maxWidth: CONTENT_WIDTH,
    font: regularFont,
    size: 7,
    lineHeight: 9,
    color: rgb(0.38, 0.45, 0.38),
  });
  y -= 14;

  routeOrders.forEach((order, index) => {
    ensureSpace(148);

    const slot = order.deliveryTimeSlot?.title ?? "слот не указан";
    const address = `${getAddressLabel(order.address)}${
      order.needsLift ? " · подъём до двери" : ""
    }`;
    const amount = formatCurrency(
      valueToNumber(order.finalTotal ?? order.preliminaryTotal),
    );
    const comments = [order.customerComment, order.adminComment]
      .map((comment) => comment?.trim())
      .filter(Boolean)
      .join(" · ");
    const items = (order.items ?? [])
      .slice(0, 5)
      .map((item) => `${item.productName} ${formatQuantity(item.orderedQuantity, item.unit)}`)
      .join("; ");

    page.drawRectangle({
      x: PAGE_MARGIN,
      y: y - 126,
      width: CONTENT_WIDTH,
      height: 134,
      color: index % 2 === 0 ? rgb(0.98, 1, 0.97) : rgb(1, 1, 1),
      borderColor: rgb(0.83, 0.9, 0.82),
      borderWidth: 0.6,
    });

    drawText(
      page,
      `${index + 1}. ${slot} · ${order.orderNumber}`,
      PAGE_MARGIN + 12,
      y - 13,
      boldFont,
      13,
      rgb(0.1, 0.29, 0.12),
    );
    drawText(
      page,
      amount,
      A4_WIDTH - PAGE_MARGIN - 100,
      y - 13,
      boldFont,
      11,
      rgb(0.14, 0.45, 0.18),
    );
    y -= 32;

    y = drawWrappedText({
      page,
      text: `Адрес: ${address}`,
      x: PAGE_MARGIN + 12,
      y,
      maxWidth: CONTENT_WIDTH - 24,
      font: boldFont,
      size: 11,
      lineHeight: 13,
    });
    y = drawWrappedText({
      page,
      text: `Клиент: ${order.user.name} · ${order.user.phone ?? "телефон не указан"}`,
      x: PAGE_MARGIN + 12,
      y,
      maxWidth: CONTENT_WIDTH - 24,
      font: regularFont,
      size: 10,
      lineHeight: 12,
      color: rgb(0.38, 0.45, 0.38),
    });

    if (items) {
      y = drawWrappedText({
        page,
        text: `Состав: ${items}`,
        x: PAGE_MARGIN + 12,
        y,
        maxWidth: CONTENT_WIDTH - 24,
        font: regularFont,
        size: 9,
        lineHeight: 11,
        color: rgb(0.18, 0.24, 0.18),
      });
    }

    if (comments) {
      y = drawWrappedText({
        page,
        text: `Комментарий: ${comments}`,
        x: PAGE_MARGIN + 12,
        y,
        maxWidth: CONTENT_WIDTH - 24,
        font: regularFont,
        size: 8,
        lineHeight: 10,
        color: rgb(0.42, 0.35, 0.2),
      });
    }

    y -= 22;
  });

  return pdfDoc.save();
}
