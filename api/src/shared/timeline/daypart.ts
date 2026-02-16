export type MedicationDaypart = 'Morning' | 'Midday' | 'Afternoon' | 'Evening';

/**
 * Maps local clock time (HH:mm) to a daypart label.
 * Mirrors frontend/src/app/shared/utils/medication-daypart.ts.
 */
export function medicationDaypartFromLocalTime(localTime: string): MedicationDaypart | null {
  if (!/^\d{2}:\d{2}$/.test(localTime)) {
    return null;
  }

  const [hourRaw, minuteRaw] = localTime.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const minuteOfDay = hour * 60 + minute;
  const MORNING_START = 3 * 60;
  const MIDDAY_START = 11 * 60;
  const AFTERNOON_START = 14 * 60;
  const EVENING_START = 18 * 60;

  if (minuteOfDay >= MORNING_START && minuteOfDay < MIDDAY_START) return 'Morning';
  if (minuteOfDay >= MIDDAY_START && minuteOfDay < AFTERNOON_START) return 'Midday';
  if (minuteOfDay >= AFTERNOON_START && minuteOfDay < EVENING_START) return 'Afternoon';
  return 'Evening';
}
