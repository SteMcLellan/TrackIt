export type TimelineSourceType = 'incident' | 'medication_log' | 'medication' | 'daily_reflection';

export type TimelineEventOperation = 'upsert' | 'delete';

export type TimelineEventSummary = {
  title: string;
  subtitle?: string;
  status?: string;
  function?: string;
  place?: string;
  medicationId?: string;
  medicationName?: string;
  occurrenceKey?: string;
  moodScore?: number;
  focusScore?: number;
  energyScore?: number;
  sleepScore?: number;
  journalNotePreview?: string;
};

export type TimelineEvent = {
  id: string;
  participantId: string;
  eventAtUtc: string;
  logLocalDate: string;
  logLocalTime?: string;
  logTzOffsetMinutes?: number;
  sourceType: TimelineSourceType;
  sourceId: string;
  sourceContainer: string;
  sourcePartitionKey: string;
  sourceVersion: string;
  sourceCreatedAtUtc: string;
  sourceUpdatedAtUtc?: string;
  operation: TimelineEventOperation;
  tags: string[];
  summary: TimelineEventSummary;
  projectionVersion: number;
  projectedAtUtc: string;
  clusterId?: string;
};

export type TimelineCluster = {
  clusterId: string;
  startUtc: string;
  endUtc: string;
  itemCount: number;
};

export type TimelineResponse = {
  items: TimelineEvent[];
  nextCursorDate: string | null;
  windowStartDate: string;
  windowEndDate: string;
  projectionMode: 'daily-final-state';
  nextToken?: string | null;
  clusters?: TimelineCluster[];
};
