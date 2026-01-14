import { Container } from '@azure/cosmos';
import { ParticipantDocument, UserParticipantLinkDocument } from '../../models/participant';

export async function listParticipantLinks(
  container: Container,
  userId: string,
  pageSize: number,
  nextToken?: string | null
) {
  const query = {
    query: 'SELECT * FROM c WHERE c.userId = @userId',
    parameters: [{ name: '@userId', value: userId }]
  };
  return container.items
    .query<UserParticipantLinkDocument>(query, {
      partitionKey: userId,
      maxItemCount: pageSize,
      continuationToken: nextToken ?? undefined
    })
    .fetchNext();
}

export async function readParticipant(
  container: Container,
  participantId: string
): Promise<ParticipantDocument | null> {
  const { resource } = await container.item(participantId, participantId).read<ParticipantDocument>();
  return resource ?? null;
}

export async function readParticipantLink(
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
  const response = await container.items
    .query<UserParticipantLinkDocument>(query, {
      partitionKey: userId,
      maxItemCount: 1
    })
    .fetchNext();
  return response.resources?.[0] ?? null;
}
