import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Container } from '@azure/cosmos';
import { randomUUID } from 'crypto';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
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

type ValidationErrorDetail = {
  id: string;
  message: string;
};

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

function parsePageSize(value?: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 25;
  }
  return Math.min(parsed, 100);
}

async function listParticipantLinks(
  container: Container,
  userId: string,
  pageSize: number,
  nextToken?: string | null
) {
  const query = {
    query: 'SELECT * FROM c WHERE c.userId = @userId',
    parameters: [{ name: '@userId', value: userId }]
  };
  return container.items.query<UserParticipantLinkDocument>(query, {
    partitionKey: userId,
    maxItemCount: pageSize,
    continuationToken: nextToken ?? undefined
  }).fetchNext();
}

async function readParticipant(
  container: Container,
  participantId: string
): Promise<ParticipantDocument | null> {
  const { resource } = await container.item(participantId, participantId).read<ParticipantDocument>();
  return resource ?? null;
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

const participantsHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const { containers } = await buildCosmos();

    if (req.method !== 'GET' && req.method !== 'POST') {
      return { status: 405, jsonBody: { message: 'Method not allowed.' } };
    }

    if (req.method === 'GET') {
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

    let body: CreateParticipantRequest;
    try {
      body = (await req.json()) as CreateParticipantRequest;
    } catch {
      return buildValidationError([
        { id: 'participants.body.invalid', message: 'Request body must be valid JSON.' }
      ]);
    }

    const errors = validateCreateRequest(body);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    const timestamp = new Date().toISOString();
    const participantId = `participant_${randomUUID()}`;
    const participant: ParticipantDocument = {
      id: participantId,
      displayName: normalizeDisplayName(body.displayName),
      ageYears: body.ageYears,
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

app.http('participants', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'participants',
  handler: participantsHandler
});

export { participantsHandler };
