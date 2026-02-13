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
  birthDate?: string;
};

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

function calculateAgeYears(birthDate: string): number {
  const [year, month, day] = birthDate.split('-').map((part) => Number(part));
  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const monthDelta = today.getUTCMonth() + 1 - month;
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < day)) {
    age -= 1;
  }
  return age;
}

function normalizeParticipantForResponse(participant: ParticipantDocument): Omit<ParticipantDocument, 'ageYears'> & { ageYears: number | null } {
  if (typeof participant.birthDate === 'string' && isDateOnly(participant.birthDate)) {
    return {
      ...participant,
      ageYears: Math.max(calculateAgeYears(participant.birthDate), 0)
    };
  }
  return {
    ...participant,
    ageYears: participant.ageYears ?? null
  };
}

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

    return { status: 200, jsonBody: { ...normalizeParticipantForResponse(participant), role: link.role } };
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
    const hasBirthDate = typeof parsed.value.birthDate !== 'undefined';

    if (!hasDisplayName && !hasBirthDate) {
      updates.push({
        id: 'participants.update.empty',
        message: 'At least one field must be provided.'
      });
    }

    if (hasBirthDate && (!parsed.value.birthDate || !isDateOnly(parsed.value.birthDate))) {
      updates.push({
        id: 'participants.birthDate.invalid',
        message: 'Birth date must be YYYY-MM-DD.'
      });
    }
    if (hasBirthDate && parsed.value.birthDate && parsed.value.birthDate > new Date().toISOString().slice(0, 10)) {
      updates.push({
        id: 'participants.birthDate.future',
        message: 'Birth date cannot be in the future.'
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

    const updatedBirthDate =
      typeof parsed.value.birthDate === 'string' ? parsed.value.birthDate : participant.birthDate;

    const updated: ParticipantDocument = {
      ...participant,
      displayName: normalizedDisplayName.length > 0 ? normalizedDisplayName : undefined,
      birthDate: updatedBirthDate,
      ageYears:
        typeof updatedBirthDate === 'string' && isDateOnly(updatedBirthDate)
          ? Math.max(calculateAgeYears(updatedBirthDate), 0)
          : participant.ageYears ?? null
    };

    await containers.participants.items.upsert(updated);

    return { status: 200, jsonBody: { ...normalizeParticipantForResponse(updated), role: link.role } };
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
