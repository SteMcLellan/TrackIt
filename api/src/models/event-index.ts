export type EventSourceType = 'incident' | 'medication_log' | 'medication';

export type EventOperation = 'upsert' | 'delete';

export interface EventIndexSummary {
  title: string;
  subtitle?: string;
  status?: string;
  function?: string;
  place?: string;
  medicationId?: string;
  medicationName?: string;
}

/**
 * Cosmos DB timeline/event index document shape.
 * Source domain documents remain the source of truth.
 */
export interface EventIndexDocument {
  id: string;
  participantId: string;
  eventAtUtc: string;
  logLocalDate: string;
  logLocalTime?: string;
  logTzOffsetMinutes?: number;
  sourceType: EventSourceType;
  sourceId: string;
  sourceContainer: string;
  sourcePartitionKey: string;
  sourceVersion: string;
  sourceCreatedAtUtc: string;
  sourceUpdatedAtUtc?: string;
  operation: EventOperation;
  tags: string[];
  summary: EventIndexSummary;
  projectionVersion: number;
  projectedAtUtc: string;
}
