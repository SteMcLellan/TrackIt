import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { readBehaviorIncident } from '../shared/data/behavior-incidents';
import { readParticipantLink } from '../shared/data/participants';
import { BehaviorFunction, BehaviorIncidentDocument } from '../models/behavior-incident';

type UpdateBehaviorIncidentRequest = {
  antecedent?: string;
  behavior?: string;
  consequence?: string;
  occurredAtUtc?: string;
  place?: string;
  function?: BehaviorFunction;
};

const behaviorFunctionOptions: BehaviorFunction[] = ['sensory', 'tangible', 'escape', 'attention'];

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

const readBehaviorIncidentHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    const incidentId = req.params.incidentId;
    if (!participantId || !incidentId) {
      const errors: ValidationErrorDetail[] = [];
      if (!participantId) {
        errors.push({ id: 'incidents.participantId.required', message: 'Participant id is required.' });
      }
      if (!incidentId) {
        errors.push({ id: 'incidents.incidentId.required', message: 'Incident id is required.' });
      }
      return buildValidationError(errors);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const incident = await readBehaviorIncident(containers.behaviorIncidents, participantId, incidentId);
    if (!incident) {
      return { status: 404, jsonBody: { message: 'Incident not found.' } };
    }

    return { status: 200, jsonBody: incident };
  }
);

const updateBehaviorIncidentHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    const incidentId = req.params.incidentId;
    if (!participantId || !incidentId) {
      const errors: ValidationErrorDetail[] = [];
      if (!participantId) {
        errors.push({ id: 'incidents.participantId.required', message: 'Participant id is required.' });
      }
      if (!incidentId) {
        errors.push({ id: 'incidents.incidentId.required', message: 'Incident id is required.' });
      }
      return buildValidationError(errors);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const parsed = await parseJsonBody<UpdateBehaviorIncidentRequest>(req, {
      id: 'incidents.body.invalid',
      message: 'Request body must be valid JSON.'
    });
    if (!parsed.ok) {
      return parsed.response;
    }

    const errors = validateUpdateRequest(parsed.value);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    const existing = await readBehaviorIncident(containers.behaviorIncidents, participantId, incidentId);
    if (!existing) {
      return { status: 404, jsonBody: { message: 'Incident not found.' } };
    }

    const updated: BehaviorIncidentDocument = {
      ...existing,
      antecedent: typeof parsed.value.antecedent === 'string' ? parsed.value.antecedent.trim() : existing.antecedent,
      behavior: typeof parsed.value.behavior === 'string' ? parsed.value.behavior.trim() : existing.behavior,
      consequence: typeof parsed.value.consequence === 'string' ? parsed.value.consequence.trim() : existing.consequence,
      occurredAtUtc: typeof parsed.value.occurredAtUtc === 'string' ? parsed.value.occurredAtUtc : existing.occurredAtUtc,
      place: typeof parsed.value.place === 'string' ? parsed.value.place.trim() : existing.place,
      function: typeof parsed.value.function === 'string' ? parsed.value.function : existing.function,
      updatedAt: new Date().toISOString()
    };

    await containers.behaviorIncidents.items.upsert(updated);

    return { status: 200, jsonBody: updated };
  }
);

const deleteBehaviorIncidentHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    const incidentId = req.params.incidentId;
    if (!participantId || !incidentId) {
      const errors: ValidationErrorDetail[] = [];
      if (!participantId) {
        errors.push({ id: 'incidents.participantId.required', message: 'Participant id is required.' });
      }
      if (!incidentId) {
        errors.push({ id: 'incidents.incidentId.required', message: 'Incident id is required.' });
      }
      return buildValidationError(errors);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const existing = await readBehaviorIncident(containers.behaviorIncidents, participantId, incidentId);
    if (!existing) {
      return { status: 404, jsonBody: { message: 'Incident not found.' } };
    }
    await containers.behaviorIncidents.item(incidentId, participantId).delete();
    return { status: 204 };
  }
);

app.http('behavior-incident-detail-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/incidents/{incidentId}',
  handler: readBehaviorIncidentHandler
});

app.http('behavior-incident-detail-patch', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/incidents/{incidentId}',
  handler: updateBehaviorIncidentHandler
});

app.http('behavior-incident-detail-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/incidents/{incidentId}',
  handler: deleteBehaviorIncidentHandler
});

export { readBehaviorIncidentHandler, updateBehaviorIncidentHandler, deleteBehaviorIncidentHandler };
