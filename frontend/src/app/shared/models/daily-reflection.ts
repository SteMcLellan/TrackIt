export type DailyReflection = {
  id: string;
  participantId: string;
  logLocalDate: string;
  logTzOffsetMinutes: number;
  moodScore: number | null;
  focusScore: number | null;
  energyScore: number | null;
  sleepScore: number | null;
  journalNote?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  createdByUserId: string;
  updatedByUserId: string;
};

export type UpsertDailyReflectionRequest = {
  logTzOffsetMinutes: number;
  moodScore?: number | null;
  focusScore?: number | null;
  energyScore?: number | null;
  sleepScore?: number | null;
  journalNote?: string;
};

export type DailyReflectionSeriesPoint = {
  logLocalDate: string;
  score: number | null;
};

export type MetricSummary = {
  points: DailyReflectionSeriesPoint[];
  latestScore: number | null;
  averageScore: number | null;
};

export type DailyReflectionSummaryResponse = {
  startDate: string;
  endDate: string;
  days: number;
  mood: MetricSummary;
  focus: MetricSummary;
  energy: MetricSummary;
  sleep: MetricSummary;
};
