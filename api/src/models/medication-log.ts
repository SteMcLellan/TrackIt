/**
 * Cosmos DB medication log document shape.
 */
export interface MedicationLogDocument {
  id: string;
  participantId: string;
  medicationId: string;
  logLocalDate: string; // YYYY-MM-DD
  logTzOffsetMinutes: number;
  occurrenceKey: string; // "daily" for MVP
  status: 'taken' | 'not_taken';
  createdAtUtc: string;
  updatedAtUtc: string;
}
