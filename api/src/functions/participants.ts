import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { listParticipantLinks, readParticipant } from '../shared/data/participants';
import { ParticipantDocument, UserParticipantLinkDocument } from '../models/participant';

type ParticipantResponse = Omit<ParticipantDocument, 'ageYears'> & {
  ageYears: number | null;
  role: 'manager' | 'viewer';
};

type ListParticipantsResponse = {
  items: ParticipantResponse[];
  nextToken: string | null;
};

type CreateParticipantRequest = {
  displayName?: string;
  birthDate: string;
};

function parsePageSize(value?: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 25;
  }
  return Math.min(parsed, 100);
}

function normalizeDisplayName(displayName?: string | null): string | undefined {
  if (!displayName) {
    return undefined;
  }
  const trimmed = displayName.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

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

function normalizeParticipant(participant: ParticipantDocument): Omit<ParticipantDocument, 'ageYears'> & { ageYears: number | null } {
  const birthDate = participant.birthDate;
  if (typeof birthDate === 'string' && isDateOnly(birthDate)) {
    return {
      ...participant,
      birthDate,
      ageYears: Math.max(calculateAgeYears(birthDate), 0)
    };
  }
  return {
    ...participant,
    ageYears: participant.ageYears ?? null
  };
}

function validateCreateRequest(body: CreateParticipantRequest): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];

  if (typeof body.birthDate !== 'string' || !isDateOnly(body.birthDate)) {
    errors.push({
      id: 'participants.birthDate.invalid',
      message: 'Birth date must be YYYY-MM-DD.'
    });
  } else if (body.birthDate > new Date().toISOString().slice(0, 10)) {
    errors.push({
      id: 'participants.birthDate.future',
      message: 'Birth date cannot be in the future.'
    });
  }

  return errors;
}

const listParticipantsHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const { containers } = await buildCosmos();

    const pageSize = parsePageSize(req.query.get('pageSize'));
    const nextToken = req.query.get('nextToken');
    const linksPage = await listParticipantLinks(containers.userParticipantLinks, user.sub, pageSize, nextToken);
    const items: ParticipantResponse[] = [];

    for (const link of linksPage.resources ?? []) {
      const participant = await readParticipant(containers.participants, link.participantId);
      if (participant) {
        items.push({ ...normalizeParticipant(participant), role: link.role });
      }
    }

    const response: ListParticipantsResponse = {
      items,
      nextToken: linksPage.continuationToken ?? null
    };
    return { status: 200, jsonBody: response };
  }
);

const createParticipantHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const { containers } = await buildCosmos();

    const parsed = await parseJsonBody<CreateParticipantRequest>(req, {
      id: 'participants.body.invalid',
      message: 'Request body must be valid JSON.'
    });
    if (!parsed.ok) {
      return parsed.response;
    }

    const errors = validateCreateRequest(parsed.value);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    const timestamp = new Date().toISOString();
    const participantId = `participant_${randomUUID()}`;
    const birthDate = parsed.value.birthDate;
    const participant: ParticipantDocument = {
      id: participantId,
      displayName: normalizeDisplayName(parsed.value.displayName),
      birthDate,
      ageYears: Math.max(calculateAgeYears(birthDate), 0),
      createdAt: timestamp,
      createdByUserId: user.sub
    };

    await containers.participants.items.create(participant);

    const link: UserParticipantLinkDocument = {
      id: `${user.sub}:${participantId}`,
      userId: user.sub,
      participantId,
      role: 'manager',
      createdAt: timestamp
    };
    await containers.userParticipantLinks.items.create(link);

    return { status: 201, jsonBody: normalizeParticipant(participant) };
  }
);

app.http('participants-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants',
  handler: listParticipantsHandler
});

app.http('participants-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'participants',
  handler: createParticipantHandler
});

export { listParticipantsHandler, createParticipantHandler };
