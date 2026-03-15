/**
 * Cosmos DB daily reflection document shape.
 */
export interface DailyReflectionDocument {
  id: string;
  participantId: string;
  logLocalDate: string; // YYYY-MM-DD
  logTzOffsetMinutes: number; // Offset from UTC (-840 to 840)
  moodScore: number | null; // 0-100, null if not provided
  focusScore: number | null; // 0-100, null if not provided
  energyScore: number | null; // 0-100, null if not provided
  sleepScore: number | null; // 0-100, null if not provided
  journalNote?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  createdByUserId: string;
  updatedByUserId: string;
}
