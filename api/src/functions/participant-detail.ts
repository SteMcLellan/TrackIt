import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import type { ParticipantContext } from '../shared/handler-context';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { readParticipant } from '../shared/data/participants';
import { ParticipantDocument } from '../models/participant';
import { composeHttpHandler } from '../shared/http-middleware';
import { getRequestState } from '../shared/request-state';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';
import { participantMiddleware } from '../shared/middleware/participant';

type UpdateParticipantRequest = {
  displayName?: string;
  birthDate?: string;
};

export function isDateOnly(value: string): boolean {
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

export function calculateAgeYears(birthDate: string): number {
  const [year, month, day] = birthDate.split('-').map((part) => Number(part));
  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const monthDelta = today.getUTCMonth() + 1 - month;
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < day)) {
    age -= 1;
  }
  return age;
}

export function normalizeParticipantForResponse(participant: ParticipantDocument): Omit<ParticipantDocument, 'ageYears'> & { ageYears: number | null } {
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

const readParticipantInnerHandler = async (
  ctx: ParticipantContext
): Promise<HttpResponseInit> => {
    const participant = await readParticipant(ctx.containers.participants, ctx.participantId);
    if (!participant) {
      return { status: 404, jsonBody: { message: 'Participant not found.' } };
    }

    return { status: 200, jsonBody: { ...normalizeParticipantForResponse(participant), role: ctx.link.role } };
  };

const updateParticipantInnerHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
    if (ctx.link.role !== 'manager') {
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

    const participant = await readParticipant(ctx.containers.participants, ctx.participantId);
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

    await ctx.containers.participants.items.upsert(updated);

    return { status: 200, jsonBody: { ...normalizeParticipantForResponse(updated), role: ctx.link.role } };
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

const readParticipantHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: async (_req: HttpRequest, context: InvocationContext) => {
    const participantContext = requireParticipantContext(context);
    return readParticipantInnerHandler(participantContext);
  }
});

const updateParticipantHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: async (req: HttpRequest, context: InvocationContext) => {
    const participantContext = requireParticipantContext(context);
    return updateParticipantInnerHandler(participantContext, req);
  }
});

app.http('participant-detail-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}',
  handler: readParticipantHandler
});

app.http('participant-detail-patch', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}',
  handler: updateParticipantHandler
});

export { readParticipantHandler, updateParticipantHandler, readParticipantInnerHandler, updateParticipantInnerHandler };
