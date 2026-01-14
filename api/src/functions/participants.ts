import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { listParticipantLinks, readParticipant } from '../shared/data/participants';
import { ParticipantDocument, UserParticipantLinkDocument } from '../models/participant';

type ParticipantResponse = ParticipantDocument & { role: 'manager' | 'viewer' };

type ListParticipantsResponse = {
  items: ParticipantResponse[];
  nextToken: string | null;
};

type CreateParticipantRequest = {
  displayName?: string;
  ageYears: number;
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

function validateCreateRequest(body: CreateParticipantRequest): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  if (!Number.isInteger(body.ageYears) || body.ageYears <= 0) {
    errors.push({
      id: 'participants.age.invalid',
      message: 'Age must be a positive integer.'
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
        items.push({ ...participant, role: link.role });
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
    const participant: ParticipantDocument = {
      id: participantId,
      displayName: normalizeDisplayName(parsed.value.displayName),
      ageYears: parsed.value.ageYears,
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

    return { status: 201, jsonBody: participant };
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
