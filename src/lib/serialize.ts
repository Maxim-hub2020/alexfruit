export function toClientValue<T>(value: T): T {
  return convertValue(value) as T;
}

function convertValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(convertValue);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    if (value.constructor?.name?.includes("Decimal")) {
      return Number((value as { toString(): string }).toString());
    }

    const result: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = convertValue(nestedValue);
    }

    return result;
  }

  return value;
}
