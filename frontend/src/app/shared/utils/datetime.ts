/**
 * Date/time utility functions for handling local time and datetime-local inputs.
 */

/**
 * Extracts local date from datetime-local input value.
 * @param localValue - Datetime-local input value (YYYY-MM-DDTHH:mm)
 * @returns Local date in YYYY-MM-DD format
 * @example
 * extractLocalDate('2026-01-20T14:30') // '2026-01-20'
 */
export function extractLocalDate(localValue: string): string {
  return localValue.substring(0, 10);
}

/**
 * Extracts local time from datetime-local input value.
 * @param localValue - Datetime-local input value (YYYY-MM-DDTHH:mm)
 * @returns Local time in HH:mm format
 * @example
 * extractLocalTime('2026-01-20T14:30') // '14:30'
 */
export function extractLocalTime(localValue: string): string {
  return localValue.substring(11, 16);
}

/**
 * Computes timezone offset for a specific local date and time.
 * This correctly handles DST by computing the offset for the exact date/time,
 * not just the current moment.
 *
 * IMPORTANT: This function returns the offset in minutes ahead of UTC (positive = ahead).
 * JavaScript's getTimezoneOffset() returns the opposite sign, so we negate it.
 *
 * @param localDate - Local date in YYYY-MM-DD format
 * @param localTime - Local time in HH:mm format
 * @returns Offset from UTC in minutes (positive = ahead of UTC, negative = behind UTC)
 * @example
 * // For EST (winter): -300 (UTC-5)
 * computeTzOffsetMinutes('2026-01-15', '14:00') // -300
 * // For EDT (summer): -240 (UTC-4)
 * computeTzOffsetMinutes('2026-07-15', '14:00') // -240
 */
export function computeTzOffsetMinutes(localDate: string, localTime: string): number {
  // Parse the specific date and time to get historical offset (DST-aware)
  const parsed = new Date(`${localDate}T${localTime}`);
  // Negate because getTimezoneOffset() returns minutes behind UTC (opposite of what we want)
  return -parsed.getTimezoneOffset();
}

/**
 * Converts local date and time to datetime-local input format.
 * @param logLocalDate - Local date in YYYY-MM-DD format
 * @param logLocalTime - Local time in HH:mm format
 * @returns Datetime-local input value (YYYY-MM-DDTHH:mm)
 * @example
 * toDatetimeLocalInput('2026-01-20', '14:30') // '2026-01-20T14:30'
 */
export function toDatetimeLocalInput(logLocalDate: string, logLocalTime: string): string {
  return `${logLocalDate}T${logLocalTime}`;
}

/**
 * Converts UTC ISO timestamp to datetime-local input format.
 * Used for backward compatibility with legacy data that may not have local fields.
 *
 * @param utcIsoString - UTC ISO timestamp (e.g., '2026-01-20T19:30:00.000Z')
 * @returns Datetime-local input value in browser's local timezone
 * @example
 * utcToDatetimeLocalInput('2026-01-20T19:30:00.000Z') // '2026-01-20T14:30' (if in EST)
 */
export function utcToDatetimeLocalInput(utcIsoString: string): string {
  const date = new Date(utcIsoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
