import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { readParticipant, readParticipantLink } from '../shared/data/participants';
import { ParticipantDocument } from '../models/participant';

type UpdateParticipantRequest = {
  displayName?: string;
  ageYears?: number;
};

const readParticipantHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.id;
    if (!participantId) {
      return buildValidationError([
        { id: 'participants.id.required', message: 'Participant id is required.' }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const participant = await readParticipant(containers.participants, participantId);
    if (!participant) {
      return { status: 404, jsonBody: { message: 'Participant not found.' } };
    }

    return { status: 200, jsonBody: { ...participant, role: link.role } };
  }
);

const updateParticipantHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.id;
    if (!participantId) {
      return buildValidationError([
        { id: 'participants.id.required', message: 'Participant id is required.' }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }
    if (link.role !== 'manager') {
      return { status: 403, jsonBody: { message: 'Participant update requires manager role.' } };
    }

    const parsed = await parseJsonBody<UpdateParticipantRequest>(req, {
      id: 'participants.body.invalid',
      message: 'Request body must be valid JSON.'
    });
    if (!parsed.ok) {
      return parsed.response;
    }

    const updates: ValidationErrorDetail[] = [];
    const hasDisplayName = typeof parsed.value.displayName !== 'undefined';
    const hasAgeYears = typeof parsed.value.ageYears !== 'undefined';

    if (!hasDisplayName && !hasAgeYears) {
      updates.push({
        id: 'participants.update.empty',
        message: 'At least one field must be provided.'
      });
    }

    if (hasAgeYears && (!Number.isInteger(parsed.value.ageYears) || (parsed.value.ageYears ?? 0) <= 0)) {
      updates.push({
        id: 'participants.age.invalid',
        message: 'Age must be a positive integer.'
      });
    }

    if (updates.length > 0) {
      return buildValidationError(updates);
    }

    const participant = await readParticipant(containers.participants, participantId);
    if (!participant) {
      return { status: 404, jsonBody: { message: 'Participant not found.' } };
    }

    const normalizedDisplayName =
      typeof parsed.value.displayName === 'string'
        ? parsed.value.displayName.trim()
        : (participant.displayName ?? '').trim();

    const updated: ParticipantDocument = {
      ...participant,
      displayName: normalizedDisplayName.length > 0 ? normalizedDisplayName : undefined,
      ageYears: typeof parsed.value.ageYears === 'number' ? parsed.value.ageYears : participant.ageYears
    };

    await containers.participants.items.upsert(updated);

    return { status: 200, jsonBody: { ...updated, role: link.role } };
  }
);

app.http('participant-detail-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{id}',
  handler: readParticipantHandler
});

app.http('participant-detail-patch', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'participants/{id}',
  handler: updateParticipantHandler
});

export { readParticipantHandler, updateParticipantHandler };
