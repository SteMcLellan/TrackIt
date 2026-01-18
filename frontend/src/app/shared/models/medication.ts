export type Medication = {
  id: string;
  participantId: string;
  name: string;
  dosageText: string;
  frequencyText: string;
  startDateUtc: string; // YYYY-MM-DD
  endDateUtc: string | null; // YYYY-MM-DD
  notes: string | null;
  archivedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};
