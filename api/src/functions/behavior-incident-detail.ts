import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Container } from '@azure/cosmos';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { BehaviorFunction, BehaviorIncidentDocument } from '../models/behavior-incident';
import { UserParticipantLinkDocument } from '../models/participant';

type UpdateBehaviorIncidentRequest = {
  antecedent?: string;
  behavior?: string;
  consequence?: string;
  occurredAtUtc?: string;
  place?: string;
  function?: BehaviorFunction;
};

type ValidationErrorDetail = {
  id: string;
  message: string;
};

const behaviorFunctionOptions: BehaviorFunction[] = ['sensory', 'tangible', 'escape', 'attention'];

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

function validateUpdateRequest(body: UpdateBehaviorIncidentRequest): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];

  if (
    typeof body.antecedent === 'undefined' &&
    typeof body.behavior === 'undefined' &&
    typeof body.consequence === 'undefined' &&
    typeof body.occurredAtUtc === 'undefined' &&
    typeof body.place === 'undefined' &&
    typeof body.function === 'undefined'
  ) {
    errors.push({ id: 'incidents.update.empty', message: 'At least one field must be provided.' });
  }

  if (typeof body.antecedent !== 'undefined' && !isNonEmpty(body.antecedent)) {
    errors.push({ id: 'incidents.antecedent.required', message: 'Antecedent is required.' });
  }
  if (typeof body.behavior !== 'undefined' && !isNonEmpty(body.behavior)) {
    errors.push({ id: 'incidents.behavior.required', message: 'Behavior is required.' });
  }
  if (typeof body.consequence !== 'undefined' && !isNonEmpty(body.consequence)) {
    errors.push({ id: 'incidents.consequence.required', message: 'Consequence is required.' });
  }
  if (typeof body.place !== 'undefined' && !isNonEmpty(body.place)) {
    errors.push({ id: 'incidents.place.required', message: 'Place is required.' });
  }
  if (typeof body.occurredAtUtc !== 'undefined' && !isUtcIsoString(body.occurredAtUtc)) {
    errors.push({ id: 'incidents.time.invalid', message: 'Time must be a UTC ISO string.' });
  }
  if (typeof body.function !== 'undefined' && !behaviorFunctionOptions.includes(body.function)) {
    errors.push({ id: 'incidents.function.invalid', message: 'Function is not valid.' });
  }

  return errors;
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

async function readIncident(
  container: Container,
  participantId: string,
  incidentId: string
): Promise<BehaviorIncidentDocument | null> {
  const { resource } = await container.item(incidentId, participantId).read<BehaviorIncidentDocument>();
  return resource ?? null;
}

const behaviorIncidentDetailHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    const incidentId = req.params.incidentId;
    if (!participantId || !incidentId) {
      return { status: 400, jsonBody: { message: 'Participant id and incident id are required.' } };
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    if (req.method === 'PATCH') {
      let body: UpdateBehaviorIncidentRequest;
      try {
        body = (await req.json()) as UpdateBehaviorIncidentRequest;
      } catch {
        return buildValidationError([
          { id: 'incidents.body.invalid', message: 'Request body must be valid JSON.' }
        ]);
      }

      const errors = validateUpdateRequest(body);
      if (errors.length > 0) {
        return buildValidationError(errors);
      }

      const existing = await readIncident(containers.behaviorIncidents, participantId, incidentId);
      if (!existing) {
        return { status: 404, jsonBody: { message: 'Incident not found.' } };
      }

      const updated: BehaviorIncidentDocument = {
        ...existing,
        antecedent: typeof body.antecedent === 'string' ? body.antecedent.trim() : existing.antecedent,
        behavior: typeof body.behavior === 'string' ? body.behavior.trim() : existing.behavior,
        consequence: typeof body.consequence === 'string' ? body.consequence.trim() : existing.consequence,
        occurredAtUtc: typeof body.occurredAtUtc === 'string' ? body.occurredAtUtc : existing.occurredAtUtc,
        place: typeof body.place === 'string' ? body.place.trim() : existing.place,
        function: typeof body.function === 'string' ? body.function : existing.function,
        updatedAt: new Date().toISOString()
      };

      await containers.behaviorIncidents.items.upsert(updated);

      return { status: 200, jsonBody: updated };
    }

    if (req.method === 'DELETE') {
      const existing = await readIncident(containers.behaviorIncidents, participantId, incidentId);
      if (!existing) {
        return { status: 404, jsonBody: { message: 'Incident not found.' } };
      }
      await containers.behaviorIncidents.item(incidentId, participantId).delete();
      return { status: 204 };
    }

    if (req.method !== 'GET') {
      return { status: 405, jsonBody: { message: 'Method not allowed.' } };
    }

    const incident = await readIncident(containers.behaviorIncidents, participantId, incidentId);
    if (!incident) {
      return { status: 404, jsonBody: { message: 'Incident not found.' } };
    }

    return { status: 200, jsonBody: incident };
  }
);

app.http('behavior-incident-detail', {
  methods: ['GET', 'PATCH', 'DELETE'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/incidents/{incidentId}',
  handler: behaviorIncidentDetailHandler
});

export { behaviorIncidentDetailHandler };
