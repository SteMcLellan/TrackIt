import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { buildBehaviorIncidentListQuery } from '../shared/data/behavior-incidents';
import { readParticipantLink } from '../shared/data/participants';
import { BehaviorFunction, BehaviorIncidentDocument } from '../models/behavior-incident';
import { projectIncidentToEventIndex } from '../shared/timeline/projectors';
import { appendTimelineEvent } from '../shared/timeline/write-through';
import {
  isNonEmpty,
  isDateOnly,
  isTimeOnly,
  isValidTzOffset,
  isFutureDate,
  computeUtcFromLocal
} from '../shared/validators';

type CreateBehaviorIncidentRequest = {
  antecedent: string;
  behavior: string;
  consequence: string;
  logLocalDate: string;
  logLocalTime: string;
  logTzOffsetMinutes: number;
  place: string;
  function: BehaviorFunction;
  antecedentChips?: string[];
  behaviorChips?: string[];
  consequenceChips?: string[];
  placeChip?: string;
};

const behaviorFunctionOptions: BehaviorFunction[] = ['sensory', 'tangible', 'escape', 'attention'];
const maxPageSize = 100;

function parsePageSize(value?: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 25;
  }
  return Math.min(parsed, maxPageSize);
}

function validateCreateRequest(body: CreateBehaviorIncidentRequest): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];

  if (!isNonEmpty(body.antecedent)) {
    errors.push({ id: 'incidents.antecedent.required', message: 'Antecedent is required.' });
  }
  if (!isNonEmpty(body.behavior)) {
    errors.push({ id: 'incidents.behavior.required', message: 'Behavior is required.' });
  }
  if (!isNonEmpty(body.consequence)) {
    errors.push({ id: 'incidents.consequence.required', message: 'Consequence is required.' });
  }
  if (!isNonEmpty(body.place)) {
    errors.push({ id: 'incidents.place.required', message: 'Place is required.' });
  }
  if (!isDateOnly(body.logLocalDate)) {
    errors.push({ id: 'incidents.date.invalid', message: 'logLocalDate must be YYYY-MM-DD.' });
  } else if (isFutureDate(body.logLocalDate)) {
    errors.push({ id: 'incidents.date.future', message: 'logLocalDate cannot be in the future.' });
  }
  if (!isTimeOnly(body.logLocalTime)) {
    errors.push({ id: 'incidents.time.invalid', message: 'logLocalTime must be HH:mm.' });
  }
  if (!isValidTzOffset(body.logTzOffsetMinutes)) {
    errors.push({
      id: 'incidents.offset.invalid',
      message: 'logTzOffsetMinutes must be a valid timezone offset.'
    });
  }
  if (!behaviorFunctionOptions.includes(body.function)) {
    errors.push({ id: 'incidents.function.invalid', message: 'Function is not valid.' });
  }

  return errors;
}

type ListBehaviorIncidentsResponse = {
  items: BehaviorIncidentDocument[];
  nextToken: string | null;
};

const listBehaviorIncidentsHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    if (!participantId) {
      return buildValidationError([
        { id: 'incidents.participantId.required', message: 'Participant id is required.' }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const pageSize = parsePageSize(req.query.get('pageSize'));
    const nextToken = req.query.get('nextToken');
    const functionFilter = req.query.get('function') as BehaviorFunction | null;
    const startDate = req.query.get('startDate');
    const endDate = req.query.get('endDate');

    const listErrors: ValidationErrorDetail[] = [];
    if (functionFilter && !behaviorFunctionOptions.includes(functionFilter)) {
      listErrors.push({ id: 'incidents.function.invalid', message: 'Function is not valid.' });
    }
    if (startDate && !isDateOnly(startDate)) {
      listErrors.push({ id: 'incidents.startDate.invalid', message: 'startDate must be YYYY-MM-DD.' });
    }
    if (endDate && !isDateOnly(endDate)) {
      listErrors.push({ id: 'incidents.endDate.invalid', message: 'endDate must be YYYY-MM-DD.' });
    }
    if (startDate && endDate && isDateOnly(startDate) && isDateOnly(endDate) && startDate > endDate) {
      listErrors.push({
        id: 'incidents.dateRange.invalid',
        message: 'startDate must be before or equal to endDate.'
      });
    }
    if (listErrors.length > 0) {
      return buildValidationError(listErrors);
    }

    const query = buildBehaviorIncidentListQuery(
      participantId,
      functionFilter ?? undefined,
      startDate ?? undefined,
      endDate ?? undefined
    );
    const response = await containers.behaviorIncidents.items.query<BehaviorIncidentDocument>(query, {
      partitionKey: participantId,
      maxItemCount: pageSize,
      continuationToken: nextToken ?? undefined
    }).fetchNext();

    const payload: ListBehaviorIncidentsResponse = {
      items: response.resources ?? [],
      nextToken: response.continuationToken ?? null
    };
    return { status: 200, jsonBody: payload };
  }
);

const createBehaviorIncidentHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    if (!participantId) {
      return buildValidationError([
        { id: 'incidents.participantId.required', message: 'Participant id is required.' }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const parsed = await parseJsonBody<CreateBehaviorIncidentRequest>(req, {
      id: 'incidents.body.invalid',
      message: 'Request body must be valid JSON.'
    });
    if (!parsed.ok) {
      return parsed.response;
    }

    const errors = validateCreateRequest(parsed.value);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    const now = new Date().toISOString();
    const occurredAtUtc = computeUtcFromLocal(
      parsed.value.logLocalDate,
      parsed.value.logLocalTime,
      parsed.value.logTzOffsetMinutes
    );

    const incident: BehaviorIncidentDocument = {
      id: `incident_${randomUUID()}`,
      participantId,
      antecedent: parsed.value.antecedent.trim(),
      behavior: parsed.value.behavior.trim(),
      consequence: parsed.value.consequence.trim(),
      occurredAtUtc,
      logLocalDate: parsed.value.logLocalDate,
      logLocalTime: parsed.value.logLocalTime,
      logTzOffsetMinutes: parsed.value.logTzOffsetMinutes,
      place: parsed.value.place.trim(),
      function: parsed.value.function,
      createdAtUtc: now,
      createdByUserId: user.sub,
      antecedentChips: parsed.value.antecedentChips,
      behaviorChips: parsed.value.behaviorChips,
      consequenceChips: parsed.value.consequenceChips,
      placeChip: parsed.value.placeChip
    };

    await containers.behaviorIncidents.items.create(incident);
    await appendTimelineEvent(containers.eventIndex, projectIncidentToEventIndex(incident));

    return { status: 201, jsonBody: incident };
  }
);

app.http('behavior-incidents-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/incidents',
  handler: listBehaviorIncidentsHandler
});

app.http('behavior-incidents-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/incidents',
  handler: createBehaviorIncidentHandler
});

export { listBehaviorIncidentsHandler, createBehaviorIncidentHandler };
