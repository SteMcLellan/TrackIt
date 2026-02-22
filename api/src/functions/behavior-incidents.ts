import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import type { ParticipantContext } from '../shared/handler-context';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { buildBehaviorIncidentListQuery } from '../shared/data/behavior-incidents';
import { BehaviorFunction, BehaviorIncidentDocument } from '../models/behavior-incident';
import { projectIncidentToEventIndex } from '../shared/timeline/projectors';
import { appendTimelineEvent } from '../shared/timeline/write-through';
import { composeHttpHandler } from '../shared/http-middleware';
import { getRequestState } from '../shared/request-state';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';
import { participantMiddleware } from '../shared/middleware/participant';
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

export function parsePageSize(value?: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 25;
  }
  return Math.min(parsed, maxPageSize);
}

export function validateCreateRequest(body: CreateBehaviorIncidentRequest): ValidationErrorDetail[] {
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

const listBehaviorIncidentsInnerHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
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
      ctx.participantId,
      functionFilter ?? undefined,
      startDate ?? undefined,
      endDate ?? undefined
    );
    const response = await ctx.containers.behaviorIncidents.items.query<BehaviorIncidentDocument>(query, {
      partitionKey: ctx.participantId,
      maxItemCount: pageSize,
      continuationToken: nextToken ?? undefined
    }).fetchNext();

    const payload: ListBehaviorIncidentsResponse = {
      items: response.resources ?? [],
      nextToken: response.continuationToken ?? null
    };
    return { status: 200, jsonBody: payload };
  };

const createBehaviorIncidentInnerHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
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
      participantId: ctx.participantId,
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
      createdByUserId: ctx.user.sub,
      antecedentChips: parsed.value.antecedentChips,
      behaviorChips: parsed.value.behaviorChips,
      consequenceChips: parsed.value.consequenceChips,
      placeChip: parsed.value.placeChip
    };

    await ctx.containers.behaviorIncidents.items.create(incident);
    await appendTimelineEvent(ctx.containers.eventIndex, projectIncidentToEventIndex(incident));

    return { status: 201, jsonBody: incident };
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

const listBehaviorIncidentsHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const participantContext = requireParticipantContext(context);
    return listBehaviorIncidentsInnerHandler(participantContext, req);
  }
});

const createBehaviorIncidentHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const participantContext = requireParticipantContext(context);
    return createBehaviorIncidentInnerHandler(participantContext, req);
  }
});

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

export { listBehaviorIncidentsHandler, createBehaviorIncidentHandler, listBehaviorIncidentsInnerHandler, createBehaviorIncidentInnerHandler };
