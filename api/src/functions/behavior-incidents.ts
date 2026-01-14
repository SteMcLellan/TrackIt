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

type CreateBehaviorIncidentRequest = {
  antecedent: string;
  behavior: string;
  consequence: string;
  occurredAtUtc: string;
  place: string;
  function: BehaviorFunction;
};

const behaviorFunctionOptions: BehaviorFunction[] = ['sensory', 'tangible', 'escape', 'attention'];
const maxPageSize = 100;

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isUtcIsoString(value: string): boolean {
  if (!value.endsWith('Z')) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

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
  if (!isNonEmpty(body.occurredAtUtc) || !isUtcIsoString(body.occurredAtUtc)) {
    errors.push({ id: 'incidents.time.invalid', message: 'Time must be a UTC ISO string.' });
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
    const fromUtc = req.query.get('fromUtc');
    const toUtc = req.query.get('toUtc');

    const listErrors: ValidationErrorDetail[] = [];
    if (functionFilter && !behaviorFunctionOptions.includes(functionFilter)) {
      listErrors.push({ id: 'incidents.function.invalid', message: 'Function is not valid.' });
    }
    if (fromUtc && !isUtcIsoString(fromUtc)) {
      listErrors.push({ id: 'incidents.fromUtc.invalid', message: 'fromUtc must be a UTC ISO string.' });
    }
    if (toUtc && !isUtcIsoString(toUtc)) {
      listErrors.push({ id: 'incidents.toUtc.invalid', message: 'toUtc must be a UTC ISO string.' });
    }
    if (listErrors.length > 0) {
      return buildValidationError(listErrors);
    }

    const query = buildBehaviorIncidentListQuery(
      participantId,
      functionFilter ?? undefined,
      fromUtc ?? undefined,
      toUtc ?? undefined
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
    const incident: BehaviorIncidentDocument = {
      id: `incident_${randomUUID()}`,
      participantId,
      antecedent: parsed.value.antecedent.trim(),
      behavior: parsed.value.behavior.trim(),
      consequence: parsed.value.consequence.trim(),
      occurredAtUtc: parsed.value.occurredAtUtc,
      place: parsed.value.place.trim(),
      function: parsed.value.function,
      createdAt: now,
      createdByUserId: user.sub
    };

    await containers.behaviorIncidents.items.create(incident);

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
