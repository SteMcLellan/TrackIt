import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import type { ParticipantContext } from '../shared/handler-context';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import {
  buildTimelineAnchorQuery,
  buildTimelineByLocalDateQuery,
  buildTimelineNextDateQuery,
  buildTimelineRangeQuery
} from '../shared/data/event-index';
import { EventIndexDocument, EventSourceType } from '../models/event-index';
import { projectDailyTimelineItems } from '../shared/timeline/daily-projection';
import { composeHttpHandler } from '../shared/http-middleware';
import { getRequestState } from '../shared/request-state';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';
import { participantMiddleware } from '../shared/middleware/participant';

const sourceTypeOptions: EventSourceType[] = ['incident', 'medication_log', 'medication', 'daily_reflection'];
const defaultSourceTypeFilter: EventSourceType[] = ['incident', 'medication_log', 'medication'];
const MAX_DAYS_PER_REQUEST = 7;
const MAX_TIMELINE_ITEMS = 500;

type ListTimelineResponse = {
  items: EventIndexDocument[];
  nextCursorDate: string | null;
  windowStartDate: string;
  windowEndDate: string;
  projectionMode: 'daily-final-state';
};

export function isTimelineQueryEnabled(): boolean {
  const value = (process.env.TIMELINE_QUERY_ENABLED || 'true').toLowerCase();
  return value !== 'false' && value !== '0';
}

export function isIsoUtc(value: string | null): boolean {
  if (!value || !value.endsWith('Z')) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

export function isDateOnly(value: string | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function addDaysDateOnly(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function parseSourceTypes(value: string | null): EventSourceType[] | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is EventSourceType => sourceTypeOptions.includes(item as EventSourceType));
  return parsed.length > 0 ? parsed : undefined;
}

export function parseTags(value: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return parsed.length > 0 ? parsed : undefined;
}

export function parseSortOrder(value: string | null): 'asc' | 'desc' {
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

export function parseDays(value: string | null): number {
  if (!value) {
    return 1;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.min(parsed, MAX_DAYS_PER_REQUEST);
}

export function validateTimelineListRequest(date: string | null, cursorDate: string | null): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  if (!isDateOnly(date)) {
    errors.push({ id: 'timeline.date.invalid', message: 'date must be YYYY-MM-DD.' });
  }
  if (cursorDate && !isDateOnly(cursorDate)) {
    errors.push({ id: 'timeline.cursorDate.invalid', message: 'cursorDate must be YYYY-MM-DD.' });
  }
  return errors;
}

export function validateTimelineRequest(startUtc: string | null, endUtc: string | null): ValidationErrorDetail[] {
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

const listTimelineInnerHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
    if (!isTimelineQueryEnabled()) {
      return { status: 404, jsonBody: { message: 'Timeline query is disabled.' } };
    }

    const date = req.query.get('date');
    const cursorDate = req.query.get('cursorDate');
    const errors = validateTimelineListRequest(date, cursorDate);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    const sourceTypes = parseSourceTypes(req.query.get('$types')) ?? defaultSourceTypeFilter;
    const days = parseDays(req.query.get('days'));
    const windowEndDate = cursorDate ?? date!;
    const windowStartDate = addDaysDateOnly(windowEndDate, -(days - 1));

    const query = buildTimelineByLocalDateQuery({
      participantId: ctx.participantId,
      startDate: windowStartDate,
      endDate: windowEndDate,
      sourceTypes
    });

    const response = await ctx.containers.eventIndex.items.query<EventIndexDocument>(query, {
      partitionKey: ctx.participantId,
      maxItemCount: MAX_TIMELINE_ITEMS
    }).fetchNext();

    const projected = projectDailyTimelineItems(response.resources ?? []);

    const nextCursorResponse = await ctx.containers.eventIndex.items.query<{ logLocalDate: string }>(
      buildTimelineNextDateQuery({
        participantId: ctx.participantId,
        beforeDate: windowStartDate,
        sourceTypes
      }),
      {
        partitionKey: ctx.participantId,
        maxItemCount: 1
      }
    ).fetchNext();
    const nextCursorDate = nextCursorResponse.resources?.[0]?.logLocalDate ?? null;

    const payload: ListTimelineResponse = {
      items: projected,
      nextCursorDate,
      windowStartDate,
      windowEndDate,
      projectionMode: 'daily-final-state'
    };
    return { status: 200, jsonBody: payload };
  };

const timelineContextInnerHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
    if (!isTimelineQueryEnabled()) {
      return { status: 404, jsonBody: { message: 'Timeline query is disabled.' } };
    }

    const sourceType = req.params.sourceType as EventSourceType | undefined;
    const sourceId = req.params.sourceId;
    if (!sourceType || !sourceId) {
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

    const sourceTypes = parseSourceTypes(req.query.get('$types')) ?? defaultSourceTypeFilter;
    const tags = parseTags(req.query.get('$tags'));
    const sortOrder = parseSortOrder(req.query.get('$orderBy'));

    const anchorQuery = buildTimelineAnchorQuery(ctx.participantId, sourceType, sourceId);
    const anchorResponse = await ctx.containers.eventIndex.items.query<EventIndexDocument>(anchorQuery, {
      partitionKey: ctx.participantId,
      maxItemCount: 1
    }).fetchNext();
    const anchor = anchorResponse.resources?.[0];
    if (!anchor) {
      return { status: 404, jsonBody: { message: 'Timeline anchor event not found.' } };
    }

    const anchorMillis = new Date(anchor.eventAtUtc).getTime();
    const rangeStart = new Date(anchorMillis - minutes * 60 * 1000).toISOString();
    const rangeEnd = new Date(anchorMillis + minutes * 60 * 1000).toISOString();
    const validationErrors = validateTimelineRequest(rangeStart, rangeEnd);
    if (validationErrors.length > 0) {
      return buildValidationError(validationErrors);
    }
    const query = buildTimelineRangeQuery({
      participantId: ctx.participantId,
      startUtc: rangeStart,
      endUtc: rangeEnd,
      sourceTypes,
      tags,
      sortOrder
    });

    const response = await ctx.containers.eventIndex.items.query<EventIndexDocument>(query, {
      partitionKey: ctx.participantId,
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
  };

function requireParticipantContext(context: InvocationContext): ParticipantContext {
  const state = getRequestState(context);
  if (!state.containers || !state.user || !state.participant) {
    throw new Error('Participant context was not initialized.');
  }

  return {
    user: state.user,
    containers: state.containers,
    participantId: state.participant.id,
    link: state.participant.link
  };
}

const listTimelineHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const participantContext = requireParticipantContext(context);
    return listTimelineInnerHandler(participantContext, req);
  }
});

const timelineContextHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const participantContext = requireParticipantContext(context);
    return timelineContextInnerHandler(participantContext, req);
  }
});

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

export { listTimelineHandler, timelineContextHandler, listTimelineInnerHandler, timelineContextInnerHandler };
