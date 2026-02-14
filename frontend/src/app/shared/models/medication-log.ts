export type MedicationLog = {
  id: string;
  participantId: string;
  medicationId: string;
  logLocalDate: string; // YYYY-MM-DD
  logLocalTime?: string; // HH:mm
  logTzOffsetMinutes: number;
  takenAtUtc?: string;
  occurrenceKey: string;
  status: 'taken' | 'not_taken';
  createdAtUtc: string;
  updatedAtUtc: string;
};
