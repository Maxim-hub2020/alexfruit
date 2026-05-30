export const APP_NAME = "АлексФрут";
export const DELIVERY_FEE = 0;
export const AUTH_COOKIE_NAME = "alexfrut-session";

export const roleLabels: Record<string, string> = {
  CUSTOMER: "Клиент",
  ADMIN: "Администратор",
  COURIER: "Курьер",
};

export const stockStatusLabels: Record<string, string> = {
  IN_STOCK: "В наличии",
  LOW: "Осталось мало",
  OUT_OF_STOCK: "Нет в наличии",
};

export const unitLabels: Record<string, string> = {
  KG: "кг",
  PIECE: "шт.",
  PACK: "упак.",
};

export const labelPrintableOrderStatuses = [
  "CONFIRMED",
  "ASSEMBLING",
  "ASSEMBLED",
  "HANDED_TO_COURIER",
  "COURIER_ON_THE_WAY",
  "DELIVERED",
  "DELIVERY_ISSUE",
] as const;

export function canPrintOrderLabelStatus(status: string) {
  return labelPrintableOrderStatuses.includes(
    status as (typeof labelPrintableOrderStatuses)[number],
  );
}

export const orderStatusMeta: Record<
  string,
  { label: string; tone: string; description: string }
> = {
  NEW: {
    label: "Новый",
    tone: "bg-lime-100 text-lime-900",
    description: "Ожидает первого подтверждения",
  },
  PENDING_CONFIRMATION: {
    label: "Ожидает подтверждения",
    tone: "bg-amber-100 text-amber-900",
    description: "Нужно согласование по составу или времени",
  },
  CONFIRMED: {
    label: "Подтверждён",
    tone: "bg-emerald-100 text-emerald-900",
    description: "Заказ принят и готов к сборке",
  },
  ASSEMBLING: {
    label: "Собирается",
    tone: "bg-sky-100 text-sky-900",
    description: "Сборщик уточняет фактический вес",
  },
  ASSEMBLED: {
    label: "Собран",
    tone: "bg-cyan-100 text-cyan-900",
    description: "Ожидает передачи курьеру",
  },
  HANDED_TO_COURIER: {
    label: "Передан курьеру",
    tone: "bg-violet-100 text-violet-900",
    description: "Маршрут подтверждён",
  },
  COURIER_ON_THE_WAY: {
    label: "Курьер в пути",
    tone: "bg-fuchsia-100 text-fuchsia-900",
    description: "Доставка выполняется",
  },
  DELIVERED: {
    label: "Доставлен",
    tone: "bg-green-100 text-green-900",
    description: "Заказ завершён",
  },
  CANCELLED: {
    label: "Отменён",
    tone: "bg-rose-100 text-rose-900",
    description: "Заказ отменён клиентом или администратором",
  },
  DELIVERY_ISSUE: {
    label: "Проблема с доставкой",
    tone: "bg-orange-100 text-orange-900",
    description: "Нужно вручную решить ситуацию по доставке",
  },
};

export const notificationTypeLabels: Record<string, string> = {
  ORDER_CREATED: "Заказ создан",
  ORDER_CONFIRMED: "Заказ подтверждён",
  ORDER_UPDATED: "Заказ обновлён",
  ORDER_ASSEMBLED: "Заказ собран",
  ORDER_HANDED_TO_COURIER: "Передан курьеру",
  COURIER_ON_THE_WAY: "Курьер в пути",
  ORDER_DELIVERED: "Заказ доставлен",
  ORDER_CANCELLED: "Заказ отменён",
  REPLACEMENT_REQUIRED: "Нужна замена товара",
};

export const courierProblemLabels: Record<string, string> = {
  CUSTOMER_UNREACHABLE: "Клиент не отвечает",
  CUSTOMER_ABSENT: "Клиента нет дома",
  RESCHEDULE: "Перенос доставки",
  FAILED_DELIVERY: "Не удалось доставить",
  OTHER: "Другая проблема",
};
