/**
 * Cosmos DB medication document shape.
 */
export type MedicationFrequency =
  | 'once-daily'
  | 'twice-daily'
  | 'three-times-daily'
  | 'interval-days'
  | 'as-needed';

export interface IntervalSchedule {
  intervalDays: number; // integer between 2 and 30
  anchorDateLocal: string | null; // YYYY-MM-DD
  anchorPolicy: 'reset-on-taken';
}

export interface MedicationDocument {
  id: string;
  participantId: string;
  name: string;
  dosageText: string;
  frequency: MedicationFrequency;
  intervalSchedule?: IntervalSchedule | null;
  startDateUtc: string; // YYYY-MM-DD
  endDateUtc: string | null; // YYYY-MM-DD
  notes: string | null;
  archivedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}
