/**
 * Cosmos DB medication document shape.
 */
export type MedicationFrequency =
  | 'once-daily'
  | 'twice-daily'
  | 'three-times-daily'
  | 'as-needed';

export interface MedicationDocument {
  id: string;
  participantId: string;
  name: string;
  dosageText: string;
  frequency: MedicationFrequency;
  startDateUtc: string; // YYYY-MM-DD
  endDateUtc: string | null; // YYYY-MM-DD
  notes: string | null;
  archivedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}
