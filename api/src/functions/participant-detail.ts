import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Container } from '@azure/cosmos';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { ParticipantDocument, UserParticipantLinkDocument } from '../models/participant';

type UpdateParticipantRequest = {
  displayName?: string;
  ageYears?: number;
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

async function readParticipant(
  container: Container,
  participantId: string
): Promise<ParticipantDocument | null> {
  const { resource } = await container.item(participantId, participantId).read<ParticipantDocument>();
  return resource ?? null;
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

const participantDetailHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.id;
    if (!participantId) {
      return { status: 400, jsonBody: { message: 'Participant id is required.' } };
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    if (req.method === 'PATCH') {
      if (link.role !== 'manager') {
        return { status: 403, jsonBody: { message: 'Participant update requires manager role.' } };
      }

      let body: UpdateParticipantRequest;
      try {
        body = (await req.json()) as UpdateParticipantRequest;
      } catch {
        return buildValidationError([
          { id: 'participants.body.invalid', message: 'Request body must be valid JSON.' }
        ]);
      }

      const updates: ValidationErrorDetail[] = [];
      const hasDisplayName = typeof body.displayName !== 'undefined';
      const hasAgeYears = typeof body.ageYears !== 'undefined';

      if (!hasDisplayName && !hasAgeYears) {
        updates.push({
          id: 'participants.update.empty',
          message: 'At least one field must be provided.'
        });
      }

      if (hasAgeYears && (!Number.isInteger(body.ageYears) || (body.ageYears ?? 0) <= 0)) {
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
        typeof body.displayName === 'string'
          ? body.displayName.trim()
          : (participant.displayName ?? '').trim();

      const updated: ParticipantDocument = {
        ...participant,
        displayName: normalizedDisplayName.length > 0 ? normalizedDisplayName : undefined,
        ageYears: typeof body.ageYears === 'number' ? body.ageYears : participant.ageYears
      };

      await containers.participants.items.upsert(updated);

      return { status: 200, jsonBody: { ...updated, role: link.role } };
    }

    if (req.method !== 'GET') {
      return { status: 405, jsonBody: { message: 'Method not allowed.' } };
    }

    const participant = await readParticipant(containers.participants, participantId);
    if (!participant) {
      return { status: 404, jsonBody: { message: 'Participant not found.' } };
    }

    return { status: 200, jsonBody: { ...participant, role: link.role } };
  }
);

app.http('participant-detail', {
  methods: ['GET', 'PATCH'],
  authLevel: 'anonymous',
  route: 'participants/{id}',
  handler: participantDetailHandler
});

export { participantDetailHandler };
