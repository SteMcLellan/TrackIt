import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import type { ParticipantContext } from '../shared/handler-context';
import { buildValidationError } from '../shared/errors';
import { buildTimelineByLocalDateQuery } from '../shared/data/event-index';
import { EventIndexDocument, EventSourceType } from '../models/event-index';
import { bindBusinessHandler, resolveParticipantContext } from '../shared/endpoint-template';
import { composeHttpHandler } from '../shared/http-middleware';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';
import { participantMiddleware } from '../shared/middleware/participant';

const sourceTypeOptions: EventSourceType[] = ['incident', 'medication_log', 'medication', 'daily_reflection'];
const defaultSourceTypeFilter: EventSourceType[] = ['incident', 'medication_log', 'medication', 'daily_reflection'];

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

const listRawEventIndexByDateBusinessHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
    const date = req.query.get('date');
    if (!isDateOnly(date)) {
      return buildValidationError([
        { id: 'eventIndex.date.invalid', message: 'date must be YYYY-MM-DD.' }
      ]);
    }

    const sourceTypes = parseSourceTypes(req.query.get('$types')) ?? defaultSourceTypeFilter;

    const query = buildTimelineByLocalDateQuery({
      participantId: ctx.participantId,
      startDate: date!,
      endDate: date!,
      sourceTypes
    });
    const response = await ctx.containers.eventIndex.items.query<EventIndexDocument>(query, {
      partitionKey: ctx.participantId,
      maxItemCount: 500
    }).fetchNext();
    const items = [...(response.resources ?? [])].sort((left, right) => (
      right.eventAtUtc.localeCompare(left.eventAtUtc)
    ));

    return {
      status: 200,
      jsonBody: {
        date,
        items
      }
    };
  };

const listRawEventIndexByDateHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: bindBusinessHandler(resolveParticipantContext, listRawEventIndexByDateBusinessHandler)
});

app.http('event-index-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/event-index',
  handler: listRawEventIndexByDateHandler
});

export { listRawEventIndexByDateHandler, listRawEventIndexByDateBusinessHandler };

