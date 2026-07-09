const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Check if a value is a valid ISO date.
 * @param value - Value to validate.
 * @returns True when the value is YYYY-MM-DD.
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !isoDateRegex.test(value)) {
    return false;
  }

  return formatIsoDate(parseIsoDate(value)) === value;
}

/**
 * Parse an ISO date as UTC midnight.
 * @param value - ISO date.
 * @returns Parsed date.
 */
export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Format a date as YYYY-MM-DD.
 * @param date - Date value.
 * @returns ISO date string.
 */
export function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Expand an inclusive date range into daily ISO dates.
 * @param from - Start date.
 * @param to - End date.
 * @returns Daily dates.
 */
export function expandDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = parseIsoDate(from);
  const end = parseIsoDate(to);

  while (current <= end) {
    dates.push(formatIsoDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}
