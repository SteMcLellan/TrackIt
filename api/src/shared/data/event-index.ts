import type { SqlParameter, SqlQuerySpec } from '@azure/cosmos';
import { EventIndexDocument, EventSourceType } from '../../models/event-index';

export type ListTimelineQueryOptions = {
  participantId: string;
  startUtc: string;
  endUtc: string;
  sourceTypes?: EventSourceType[];
  tags?: string[];
  sortOrder: 'asc' | 'desc';
};

export type ListTimelineByDateOptions = {
  participantId: string;
  startDate: string;
  endDate: string;
  sourceTypes?: EventSourceType[];
};

export type FindNextTimelineDateOptions = {
  participantId: string;
  beforeDate: string;
  sourceTypes?: EventSourceType[];
};

export function buildTimelineRangeQuery(options: ListTimelineQueryOptions): SqlQuerySpec {
  const conditions: string[] = [
    'c.participantId = @participantId',
    'c.eventAtUtc >= @startUtc',
    'c.eventAtUtc <= @endUtc'
  ];
  const parameters: SqlParameter[] = [
    { name: '@participantId', value: options.participantId },
    { name: '@startUtc', value: options.startUtc },
    { name: '@endUtc', value: options.endUtc }
  ];

  if (options.sourceTypes && options.sourceTypes.length > 0) {
    conditions.push('ARRAY_CONTAINS(@sourceTypes, c.sourceType)');
    parameters.push({ name: '@sourceTypes', value: options.sourceTypes });
  }

  if (options.tags && options.tags.length > 0) {
    const tagConditions = options.tags.map((_, index) => `ARRAY_CONTAINS(c.tags, @tag${index})`);
    conditions.push(`(${tagConditions.join(' OR ')})`);
    for (let i = 0; i < options.tags.length; i++) {
      parameters.push({ name: `@tag${i}`, value: options.tags[i] });
    }
  }

  return {
    query: `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.eventAtUtc ${options.sortOrder === 'asc' ? 'ASC' : 'DESC'}`,
    parameters
  };
}

export function buildTimelineByLocalDateQuery(options: ListTimelineByDateOptions): SqlQuerySpec {
  const conditions: string[] = [
    'c.participantId = @participantId',
    'c.logLocalDate >= @startDate',
    'c.logLocalDate <= @endDate'
  ];
  const parameters: SqlParameter[] = [
    { name: '@participantId', value: options.participantId },
    { name: '@startDate', value: options.startDate },
    { name: '@endDate', value: options.endDate }
  ];

  if (options.sourceTypes && options.sourceTypes.length > 0) {
    conditions.push('ARRAY_CONTAINS(@sourceTypes, c.sourceType)');
    parameters.push({ name: '@sourceTypes', value: options.sourceTypes });
  }

  return {
    query: `
      SELECT * FROM c
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.logLocalDate ASC, c.eventAtUtc ASC
    `,
    parameters
  };
}

export function buildTimelineNextDateQuery(options: FindNextTimelineDateOptions): SqlQuerySpec {
  const conditions: string[] = [
    'c.participantId = @participantId',
    'c.logLocalDate < @beforeDate'
  ];
  const parameters: SqlParameter[] = [
    { name: '@participantId', value: options.participantId },
    { name: '@beforeDate', value: options.beforeDate }
  ];

  if (options.sourceTypes && options.sourceTypes.length > 0) {
    conditions.push('ARRAY_CONTAINS(@sourceTypes, c.sourceType)');
    parameters.push({ name: '@sourceTypes', value: options.sourceTypes });
  }

  return {
    query: `
      SELECT TOP 1 c.logLocalDate FROM c
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.logLocalDate DESC
    `,
    parameters
  };
}

export function buildTimelineAnchorQuery(
  participantId: string,
  sourceType: EventSourceType,
  sourceId: string
): SqlQuerySpec {
  return {
    query: `
      SELECT TOP 1 * FROM c
      WHERE c.participantId = @participantId
        AND c.sourceType = @sourceType
        AND c.sourceId = @sourceId
      ORDER BY c.eventAtUtc DESC
    `,
    parameters: [
      { name: '@participantId', value: participantId },
      { name: '@sourceType', value: sourceType },
      { name: '@sourceId', value: sourceId }
    ]
  };
}

export function applyTimelineClusters(
  items: EventIndexDocument[],
  minutes: number
): Array<EventIndexDocument & { clusterId: string }> {
  if (items.length === 0) {
    return [];
  }

  const sorted = [...items].sort((a, b) => a.eventAtUtc.localeCompare(b.eventAtUtc));
  const thresholdMs = minutes * 60 * 1000;
  const output: Array<EventIndexDocument & { clusterId: string }> = [];

  let currentCluster = 0;
  let previousTime = new Date(sorted[0].eventAtUtc).getTime();
  output.push({ ...sorted[0], clusterId: `cluster-${currentCluster}` });

  for (let index = 1; index < sorted.length; index++) {
    const item = sorted[index];
    const currentTime = new Date(item.eventAtUtc).getTime();
    if (!Number.isFinite(currentTime) || currentTime - previousTime > thresholdMs) {
      currentCluster += 1;
    }
    output.push({ ...item, clusterId: `cluster-${currentCluster}` });
    previousTime = currentTime;
  }

  return output;
}
