import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { orderStatusMeta } from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(value: number | string | { toString(): string } | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateLabel(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "d MMMM", { locale: ru });
}

export function formatDateTimeLabel(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "d MMMM, HH:mm", { locale: ru });
}

export function formatDateInputValue(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "yyyy-MM-dd");
}

export function getAddressLabel(address: {
  city: string;
  street: string;
  house: string;
  apartment?: string | null;
}) {
  return `${address.city}, ${address.street}, ${address.house}${
    address.apartment ? `, кв. ${address.apartment}` : ""
  }`;
}

export function getOrderStatusLabel(status: string) {
  return orderStatusMeta[status]?.label ?? status;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

export function dateStringToDbDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}
