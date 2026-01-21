/**
 * Shared validation functions for date, time, and timezone handling.
 */

/**
 * Validates YYYY-MM-DD date format and checks if the date is valid.
 */
export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates HH:mm time format (24-hour).
 */
export function isTimeOnly(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Validates timezone offset is within valid range [-840, 840] minutes.
 * Range covers UTC-14:00 to UTC+14:00.
 */
export function isValidTzOffset(value: number): boolean {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= 840
  );
}

/**
 * Checks if a date string (YYYY-MM-DD) represents a future date.
 * Compares at UTC day level to avoid timezone issues.
 */
export function isFutureDate(dateStr: string): boolean {
  if (!isDateOnly(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map((part) => Number(part));
  const inputDate = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return inputDate > today;
}

/**
 * Computes UTC ISO timestamp from local date, time, and timezone offset.
 * @param date - Local date in YYYY-MM-DD format
 * @param time - Local time in HH:mm format
 * @param offsetMinutes - Timezone offset from UTC in minutes (positive = ahead of UTC)
 * @returns ISO 8601 UTC timestamp string
 */
export function computeUtcFromLocal(
  date: string,
  time: string,
  offsetMinutes: number
): string {
  // Parse local components
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  // Create UTC timestamp by treating local as UTC, then subtracting offset
  const localAsUtc = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const utcTimestamp = localAsUtc - offsetMinutes * 60 * 1000;

  return new Date(utcTimestamp).toISOString();
}

/**
 * Type guard to check if a value is a non-empty string.
 */
export function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
