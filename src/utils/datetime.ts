const JAKARTA_TIME_ZONE = "Asia/Jakarta";

export function parseDateTime(
  value: string | Date | null | undefined,
): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

export function formatTimeJakarta(
  value: string | Date | null | undefined,
): string {
  const date = parseDateTime(value);

  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateTimeJakarta(
  value: string | Date | null | undefined,
): string {
  const date = parseDateTime(value);

  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function getTodayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}