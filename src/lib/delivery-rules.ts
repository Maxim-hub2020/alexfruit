export const BUSINESS_TIME_ZONE = "Europe/Moscow";
export const TODAY_DELIVERY_CUTOFF_HOUR = 9;
export const DEFAULT_DELIVERY_SLOT_TITLE = "В течение дня";
export const DEFAULT_DELIVERY_SLOT_START = "09:00";
export const DEFAULT_DELIVERY_SLOT_END = "21:00";
export const DEFAULT_DELIVERY_SLOT_CAPACITY = 10000;
export const LIFT_SERVICE_FEE = 100;

function getBusinessDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const byType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: byType.get("year") ?? "1970",
    month: byType.get("month") ?? "01",
    day: byType.get("day") ?? "01",
    hour: Number(byType.get("hour") ?? 0),
    minute: Number(byType.get("minute") ?? 0),
  };
}

export function getBusinessDateKey(value = new Date()) {
  const parts = getBusinessDateParts(value);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export function isTodayDeliveryClosed(value = new Date()) {
  const parts = getBusinessDateParts(value);

  return (
    parts.hour > TODAY_DELIVERY_CUTOFF_HOUR ||
    (parts.hour === TODAY_DELIVERY_CUTOFF_HOUR && parts.minute >= 0)
  );
}

export function getDefaultDeliveryDate(value = new Date()) {
  const today = getBusinessDateKey(value);

  return isTodayDeliveryClosed(value) ? addDaysToDateKey(today, 1) : today;
}

export function getDeliveryDateAvailability(
  deliveryDate: string,
  value = new Date(),
) {
  const dateKey = deliveryDate.slice(0, 10);
  const today = getBusinessDateKey(value);

  if (dateKey < today) {
    return {
      available: false,
      reason: "Выберите дату не раньше сегодняшнего дня.",
    };
  }

  if (dateKey === today && isTodayDeliveryClosed(value)) {
    return {
      available: false,
      reason: "Доставка на сегодня закрыта после 09:00. Выберите завтрашнюю дату.",
    };
  }

  return {
    available: true,
    reason: null,
  };
}
