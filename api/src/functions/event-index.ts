import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError } from '../shared/errors';
import { readParticipantLink } from '../shared/data/participants';
import { buildTimelineByLocalDateQuery } from '../shared/data/event-index';
import { EventIndexDocument, EventSourceType } from '../models/event-index';

const sourceTypeOptions: EventSourceType[] = ['incident', 'medication_log', 'medication', 'daily_reflection'];
const defaultSourceTypeFilter: EventSourceType[] = ['incident', 'medication_log', 'medication', 'daily_reflection'];

function isDateOnly(value: string | null): boolean {
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

const listRawEventIndexByDateHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    if (!participantId) {
      return buildValidationError([
        { id: 'eventIndex.participantId.required', message: 'Participant id is required.' }
      ]);
    }

    const date = req.query.get('date');
    if (!isDateOnly(date)) {
      return buildValidationError([
        { id: 'eventIndex.date.invalid', message: 'date must be YYYY-MM-DD.' }
      ]);
    }

    const sourceTypes = parseSourceTypes(req.query.get('$types')) ?? defaultSourceTypeFilter;

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const query = buildTimelineByLocalDateQuery({
      participantId,
      startDate: date!,
      endDate: date!,
      sourceTypes
    });
    const response = await containers.eventIndex.items.query<EventIndexDocument>(query, {
      partitionKey: participantId,
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
  }
);

app.http('event-index-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/event-index',
  handler: listRawEventIndexByDateHandler
});

export { listRawEventIndexByDateHandler };
