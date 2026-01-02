import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Container } from '@azure/cosmos';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { ParticipantDocument, UserParticipantLinkDocument } from '../models/participant';

type ParticipantResponse = ParticipantDocument & { role: 'manager' | 'viewer' };

type ListParticipantsResponse = {
  items: ParticipantResponse[];
  nextToken: string | null;
};

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

const participantsHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const { containers } = await buildCosmos();

    if (req.method !== 'GET') {
      return { status: 405, jsonBody: { message: 'Method not allowed.' } };
    }

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

app.http('participants', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants',
  handler: participantsHandler
});

export { participantsHandler };
