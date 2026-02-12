import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { readParticipantLink } from '../shared/data/participants';
import {
  applyTimelineClusters,
  buildTimelineAnchorQuery,
  buildTimelineRangeQuery
} from '../shared/data/event-index';
import { EventIndexDocument, EventSourceType } from '../models/event-index';

const sourceTypeOptions: EventSourceType[] = ['incident', 'medication_log', 'medication', 'daily_reflection'];
const defaultSourceTypeFilter: EventSourceType[] = ['incident', 'medication_log', 'medication'];

function isTimelineQueryEnabled(): boolean {
  const value = (process.env.TIMELINE_QUERY_ENABLED || 'true').toLowerCase();
  return value !== 'false' && value !== '0';
}

type TimelineItemResponse = EventIndexDocument & { clusterId?: string };

type ClusterSummary = {
  clusterId: string;
  startUtc: string;
  endUtc: string;
  itemCount: number;
};

type ListTimelineResponse = {
  items: TimelineItemResponse[];
  nextToken: string | null;
  clusters?: ClusterSummary[];
};

function isIsoUtc(value: string | null): boolean {
  if (!value || !value.endsWith('Z')) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function parseSourceTypes(value: string | null): EventSourceType[] | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is EventSourceType => sourceTypeOptions.includes(item as EventSourceType));
  return parsed.length > 0 ? parsed : undefined;
}

function parseTags(value: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return parsed.length > 0 ? parsed : undefined;
}

function parseTop(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100;
  }
  return Math.min(parsed, 500);
}

function parseClusterMinutes(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.min(parsed, 180);
}

function parseSortOrder(value: string | null): 'asc' | 'desc' {
  if (!value) {
    return 'desc';
  }
  const normalized = value.toLowerCase();
  if (normalized === 'eventatutc asc' || normalized === 'asc') {
    return 'asc';
  }
  if (normalized === 'eventatutc desc' || normalized === 'desc') {
    return 'desc';
  }
  return 'desc';
}

function buildClusterSummaries(items: Array<EventIndexDocument & { clusterId: string }>): ClusterSummary[] {
  const map = new Map<string, ClusterSummary>();
  for (const item of items) {
    const existing = map.get(item.clusterId);
    if (!existing) {
      map.set(item.clusterId, {
        clusterId: item.clusterId,
        startUtc: item.eventAtUtc,
        endUtc: item.eventAtUtc,
        itemCount: 1
      });
      continue;
    }
    if (item.eventAtUtc < existing.startUtc) {
      existing.startUtc = item.eventAtUtc;
    }
    if (item.eventAtUtc > existing.endUtc) {
      existing.endUtc = item.eventAtUtc;
    }
    existing.itemCount += 1;
  }
  return Array.from(map.values());
}

function validateTimelineRequest(startUtc: string | null, endUtc: string | null): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  if (!isIsoUtc(startUtc)) {
    errors.push({ id: 'timeline.startUtc.invalid', message: '$startUtc must be an ISO UTC value.' });
  }
  if (!isIsoUtc(endUtc)) {
    errors.push({ id: 'timeline.endUtc.invalid', message: '$endUtc must be an ISO UTC value.' });
  }
  if (startUtc && endUtc && isIsoUtc(startUtc) && isIsoUtc(endUtc) && startUtc > endUtc) {
    errors.push({
      id: 'timeline.range.invalid',
      message: '$startUtc must be less than or equal to $endUtc.'
    });
  }
  return errors;
}

const listTimelineHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    if (!isTimelineQueryEnabled()) {
      return { status: 404, jsonBody: { message: 'Timeline query is disabled.' } };
    }

    const user = authorize(context, req);
    const participantId = req.params.participantId;
    if (!participantId) {
      return buildValidationError([
        { id: 'timeline.participantId.required', message: 'Participant id is required.' }
      ]);
    }

    const startUtc = req.query.get('$startUtc');
    const endUtc = req.query.get('$endUtc');
    const errors = validateTimelineRequest(startUtc, endUtc);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    // Backward compatibility: existing clients that omit $types expect only legacy source types.
    const sourceTypes = parseSourceTypes(req.query.get('$types')) ?? defaultSourceTypeFilter;
    const tags = parseTags(req.query.get('$tags'));
    const top = parseTop(req.query.get('$top'));
    const skipToken = req.query.get('$skipToken');
    const sortOrder = parseSortOrder(req.query.get('$orderBy'));
    const clusterMinutes = parseClusterMinutes(req.query.get('$clusterMinutes'));

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const query = buildTimelineRangeQuery({
      participantId,
      startUtc: startUtc!,
      endUtc: endUtc!,
      sourceTypes,
      tags,
      sortOrder
    });

    const response = await containers.eventIndex.items.query<EventIndexDocument>(query, {
      partitionKey: participantId,
      maxItemCount: top,
      continuationToken: skipToken ?? undefined
    }).fetchNext();

    const baseItems = response.resources ?? [];
    if (!clusterMinutes) {
      const payload: ListTimelineResponse = {
        items: baseItems,
        nextToken: response.continuationToken ?? null
      };
      return { status: 200, jsonBody: payload };
    }

    const clusteredAscending = applyTimelineClusters(baseItems, clusterMinutes);
    const clusteredItems = sortOrder === 'asc'
      ? clusteredAscending
      : [...clusteredAscending].sort((a, b) => b.eventAtUtc.localeCompare(a.eventAtUtc));

    const payload: ListTimelineResponse = {
      items: clusteredItems,
      nextToken: response.continuationToken ?? null,
      clusters: buildClusterSummaries(clusteredAscending)
    };
    return { status: 200, jsonBody: payload };
  }
);

const timelineContextHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    if (!isTimelineQueryEnabled()) {
      return { status: 404, jsonBody: { message: 'Timeline query is disabled.' } };
    }

    const user = authorize(context, req);
    const participantId = req.params.participantId;
    const sourceType = req.params.sourceType as EventSourceType | undefined;
    const sourceId = req.params.sourceId;
    if (!participantId || !sourceType || !sourceId) {
      return buildValidationError([
        { id: 'timeline.context.params.required', message: 'Participant, sourceType, and sourceId are required.' }
      ]);
    }
    if (!sourceTypeOptions.includes(sourceType)) {
      return buildValidationError([
        { id: 'timeline.sourceType.invalid', message: 'sourceType is not valid.' }
      ]);
    }

    const minutes = (() => {
      const parsed = Number(req.query.get('minutes'));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return 15;
      }
      return Math.min(parsed, 180);
    })();

    // Backward compatibility for existing timeline context consumers.
    const sourceTypes = parseSourceTypes(req.query.get('$types')) ?? defaultSourceTypeFilter;
    const tags = parseTags(req.query.get('$tags'));
    const sortOrder = parseSortOrder(req.query.get('$orderBy'));

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const anchorQuery = buildTimelineAnchorQuery(participantId, sourceType, sourceId);
    const anchorResponse = await containers.eventIndex.items.query<EventIndexDocument>(anchorQuery, {
      partitionKey: participantId,
      maxItemCount: 1
    }).fetchNext();
    const anchor = anchorResponse.resources?.[0];
    if (!anchor) {
      return { status: 404, jsonBody: { message: 'Timeline anchor event not found.' } };
    }

    const anchorMillis = new Date(anchor.eventAtUtc).getTime();
    const rangeStart = new Date(anchorMillis - minutes * 60 * 1000).toISOString();
    const rangeEnd = new Date(anchorMillis + minutes * 60 * 1000).toISOString();
    const query = buildTimelineRangeQuery({
      participantId,
      startUtc: rangeStart,
      endUtc: rangeEnd,
      sourceTypes,
      tags,
      sortOrder
    });

    const response = await containers.eventIndex.items.query<EventIndexDocument>(query, {
      partitionKey: participantId,
      maxItemCount: 500
    }).fetchNext();

    return {
      status: 200,
      jsonBody: {
        anchor,
        minutes,
        rangeStartUtc: rangeStart,
        rangeEndUtc: rangeEnd,
        items: response.resources ?? []
      }
    };
  }
);

app.http('timeline-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/timeline',
  handler: listTimelineHandler
});

app.http('timeline-context', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/timeline/context/{sourceType}/{sourceId}',
  handler: timelineContextHandler
});

export { listTimelineHandler, timelineContextHandler };
