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
