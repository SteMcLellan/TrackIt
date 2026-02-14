/**
 * Cosmos DB medication log document shape.
 */
export interface MedicationLogDocument {
  id: string;
  participantId: string;
  medicationId: string;
  logLocalDate: string; // YYYY-MM-DD
  logLocalTime?: string; // HH:mm
  logTzOffsetMinutes: number;
  takenAtUtc?: string;
  occurrenceKey: string; // scheduled: dose-1..dose-N, PRN: as-needed-*
  status: 'taken' | 'not_taken';
  createdAtUtc: string;
  updatedAtUtc: string;
}
