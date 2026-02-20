export type MedicationFrequency =
  | 'once-daily'
  | 'twice-daily'
  | 'three-times-daily'
  | 'interval-days'
  | 'as-needed';

export type IntervalSchedule = {
  intervalDays: number;
  anchorDateLocal: string | null;
  anchorPolicy: 'reset-on-taken';
};

export type Medication = {
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
};
