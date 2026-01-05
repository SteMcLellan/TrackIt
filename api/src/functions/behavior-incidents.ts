import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Container } from '@azure/cosmos';
import { randomUUID } from 'crypto';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { BehaviorFunction, BehaviorIncidentDocument } from '../models/behavior-incident';
import { UserParticipantLinkDocument } from '../models/participant';

type CreateBehaviorIncidentRequest = {
  antecedent: string;
  behavior: string;
  consequence: string;
  occurredAtUtc: string;
  place: string;
  function: BehaviorFunction;
};

type ValidationErrorDetail = {
  id: string;
  message: string;
};

const behaviorFunctionOptions: BehaviorFunction[] = ['sensory', 'tangible', 'escape', 'attention'];
const maxPageSize = 100;

function buildValidationError(errors: ValidationErrorDetail[]): HttpResponseInit {
  return {
    status: 400,
    headers: { 'content-type': 'application/problem+json' },
    jsonBody: {
      type: 'https://example.net/validation-error',
      title: 'Your request is not valid.',
      status: 400,
      errors
    }
  };
}

async function readParticipantLink(
  container: Container,
  userId: string,
  participantId: string
): Promise<UserParticipantLinkDocument | null> {
  const query = {
    query: 'SELECT * FROM c WHERE c.userId = @userId AND c.participantId = @participantId',
    parameters: [
      { name: '@userId', value: userId },
      { name: '@participantId', value: participantId }
    ]
  };
  const response = await container.items.query<UserParticipantLinkDocument>(query, {
    partitionKey: userId,
    maxItemCount: 1
  }).fetchNext();
  return response.resources?.[0] ?? null;
}

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

function buildListQuery(
  participantId: string,
  functionFilter?: BehaviorFunction,
  fromUtc?: string,
  toUtc?: string
) {
  const conditions: string[] = ['c.participantId = @participantId'];
  const parameters = [{ name: '@participantId', value: participantId }];

  if (functionFilter) {
    conditions.push('c.function = @function');
    parameters.push({ name: '@function', value: functionFilter });
  }
  if (fromUtc) {
    conditions.push('c.occurredAtUtc >= @fromUtc');
    parameters.push({ name: '@fromUtc', value: fromUtc });
  }
  if (toUtc) {
    conditions.push('c.occurredAtUtc <= @toUtc');
    parameters.push({ name: '@toUtc', value: toUtc });
  }

  return {
    query: `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.occurredAtUtc DESC`,
    parameters
  };
}

const behaviorIncidentsHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    if (!participantId) {
      return { status: 400, jsonBody: { message: 'Participant id is required.' } };
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    if (req.method === 'GET') {
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

      const query = buildListQuery(participantId, functionFilter ?? undefined, fromUtc ?? undefined, toUtc ?? undefined);
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

    if (req.method !== 'POST') {
      return { status: 405, jsonBody: { message: 'Method not allowed.' } };
    }

    let body: CreateBehaviorIncidentRequest;
    try {
      body = (await req.json()) as CreateBehaviorIncidentRequest;
    } catch {
      return buildValidationError([
        { id: 'incidents.body.invalid', message: 'Request body must be valid JSON.' }
      ]);
    }

    const errors = validateCreateRequest(body);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    const now = new Date().toISOString();
    const incident: BehaviorIncidentDocument = {
      id: `incident_${randomUUID()}`,
      participantId,
      antecedent: body.antecedent.trim(),
      behavior: body.behavior.trim(),
      consequence: body.consequence.trim(),
      occurredAtUtc: body.occurredAtUtc,
      place: body.place.trim(),
      function: body.function,
      createdAt: now,
      createdByUserId: user.sub
    };

    await containers.behaviorIncidents.items.create(incident);

    return { status: 201, jsonBody: incident };
  }
);

app.http('behavior-incidents', {
  methods: ['POST', 'GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/incidents',
  handler: behaviorIncidentsHandler
});

export { behaviorIncidentsHandler };
