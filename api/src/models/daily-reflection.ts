/**
 * Cosmos DB daily reflection document shape.
 */
export interface DailyReflectionDocument {
  id: string;
  participantId: string;
  logLocalDate: string; // YYYY-MM-DD
  logTzOffsetMinutes: number; // Offset from UTC (-840 to 840)
  moodScore: number; // 0-100
  focusScore: number; // 0-100
  energyScore: number; // 0-100
  sleepScore: number; // 0-100
  journalNote?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  createdByUserId: string;
  updatedByUserId: string;
}
