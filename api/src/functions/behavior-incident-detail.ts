import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { readBehaviorIncident } from '../shared/data/behavior-incidents';
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

type UpdateBehaviorIncidentRequest = {
  antecedent?: string;
  behavior?: string;
  consequence?: string;
  logLocalDate?: string;
  logLocalTime?: string;
  logTzOffsetMinutes?: number;
  place?: string;
  function?: BehaviorFunction;
  antecedentChips?: string[];
  behaviorChips?: string[];
  consequenceChips?: string[];
  placeChip?: string;
};

const behaviorFunctionOptions: BehaviorFunction[] = ['sensory', 'tangible', 'escape', 'attention'];

function validateUpdateRequest(body: UpdateBehaviorIncidentRequest): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];

  // Check if at least one field is provided
  if (
    typeof body.antecedent === 'undefined' &&
    typeof body.behavior === 'undefined' &&
    typeof body.consequence === 'undefined' &&
    typeof body.logLocalDate === 'undefined' &&
    typeof body.logLocalTime === 'undefined' &&
    typeof body.logTzOffsetMinutes === 'undefined' &&
    typeof body.place === 'undefined' &&
    typeof body.function === 'undefined'
  ) {
    errors.push({ id: 'incidents.update.empty', message: 'At least one field must be provided.' });
  }

  // All-or-nothing validation for time fields
  const hasDate = typeof body.logLocalDate !== 'undefined';
  const hasTime = typeof body.logLocalTime !== 'undefined';
  const hasOffset = typeof body.logTzOffsetMinutes !== 'undefined';

  if (hasDate || hasTime || hasOffset) {
    if (!hasDate || !hasTime || !hasOffset) {
      errors.push({
        id: 'incidents.time.incomplete',
        message: 'Must provide all three: logLocalDate, logLocalTime, logTzOffsetMinutes'
      });
    }
  }

  // Validate individual fields
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
  if (typeof body.logLocalDate !== 'undefined') {
    if (!isDateOnly(body.logLocalDate)) {
      errors.push({ id: 'incidents.date.invalid', message: 'logLocalDate must be YYYY-MM-DD.' });
    } else if (isFutureDate(body.logLocalDate)) {
      errors.push({ id: 'incidents.date.future', message: 'logLocalDate cannot be in the future.' });
    }
  }
  if (typeof body.logLocalTime !== 'undefined' && !isTimeOnly(body.logLocalTime)) {
    errors.push({ id: 'incidents.time.invalid', message: 'logLocalTime must be HH:mm.' });
  }
  if (typeof body.logTzOffsetMinutes !== 'undefined' && !isValidTzOffset(body.logTzOffsetMinutes)) {
    errors.push({
      id: 'incidents.offset.invalid',
      message: 'logTzOffsetMinutes must be a valid timezone offset.'
    });
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

    // Compute new time fields if provided
    const logLocalDate = typeof parsed.value.logLocalDate === 'string' ? parsed.value.logLocalDate : existing.logLocalDate;
    const logLocalTime = typeof parsed.value.logLocalTime === 'string' ? parsed.value.logLocalTime : existing.logLocalTime;
    const logTzOffsetMinutes = typeof parsed.value.logTzOffsetMinutes === 'number' ? parsed.value.logTzOffsetMinutes : existing.logTzOffsetMinutes;

    // Recompute occurredAtUtc if any time field changed
    const occurredAtUtc = (
      typeof parsed.value.logLocalDate !== 'undefined' ||
      typeof parsed.value.logLocalTime !== 'undefined' ||
      typeof parsed.value.logTzOffsetMinutes !== 'undefined'
    )
      ? computeUtcFromLocal(logLocalDate, logLocalTime, logTzOffsetMinutes)
      : existing.occurredAtUtc;

    const updated: BehaviorIncidentDocument = {
      ...existing,
      antecedent: typeof parsed.value.antecedent === 'string' ? parsed.value.antecedent.trim() : existing.antecedent,
      behavior: typeof parsed.value.behavior === 'string' ? parsed.value.behavior.trim() : existing.behavior,
      consequence: typeof parsed.value.consequence === 'string' ? parsed.value.consequence.trim() : existing.consequence,
      occurredAtUtc,
      logLocalDate,
      logLocalTime,
      logTzOffsetMinutes,
      place: typeof parsed.value.place === 'string' ? parsed.value.place.trim() : existing.place,
      function: typeof parsed.value.function === 'string' ? parsed.value.function : existing.function,
      updatedAtUtc: new Date().toISOString(),
      antecedentChips: Array.isArray(parsed.value.antecedentChips) ? parsed.value.antecedentChips : existing.antecedentChips,
      behaviorChips: Array.isArray(parsed.value.behaviorChips) ? parsed.value.behaviorChips : existing.behaviorChips,
      consequenceChips: Array.isArray(parsed.value.consequenceChips) ? parsed.value.consequenceChips : existing.consequenceChips,
      placeChip: typeof parsed.value.placeChip === 'string' ? parsed.value.placeChip : existing.placeChip
    };

    await containers.behaviorIncidents.items.upsert(updated);
    await appendTimelineEvent(containers.eventIndex, projectIncidentToEventIndex(updated));

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
    await appendTimelineEvent(containers.eventIndex, projectIncidentToEventIndex(existing, 'delete'));
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
