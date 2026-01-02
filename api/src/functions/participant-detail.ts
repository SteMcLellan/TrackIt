import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Container } from '@azure/cosmos';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { ParticipantDocument, UserParticipantLinkDocument } from '../models/participant';

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

    const participant = await readParticipant(containers.participants, participantId);
    if (!participant) {
      return { status: 404, jsonBody: { message: 'Participant not found.' } };
    }

    return { status: 200, jsonBody: participant };
  }
);

app.http('participant-detail', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{id}',
  handler: participantDetailHandler
});

export { participantDetailHandler };
