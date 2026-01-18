export type MedicationLog = {
  id: string;
  participantId: string;
  medicationId: string;
  logLocalDate: string; // YYYY-MM-DD
  logTzOffsetMinutes: number;
  occurrenceKey: string;
  status: 'taken' | 'not_taken';
  createdAtUtc: string;
  updatedAtUtc: string;
};
