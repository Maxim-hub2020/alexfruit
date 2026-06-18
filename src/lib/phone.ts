export function normalizeRussianPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `+7${digits.slice(1)}`;
  }

  return value.trim();
}

export function getPhoneHref(phone?: string | null) {
  const normalized = phone?.trim().replace(/[^\d+]/g, "") ?? "";

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("8") && normalized.length === 11) {
    return `+7${normalized.slice(1)}`;
  }

  if (normalized.startsWith("7") && normalized.length === 11) {
    return `+${normalized}`;
  }

  return normalized;
}
