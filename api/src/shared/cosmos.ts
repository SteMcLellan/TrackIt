import { CosmosClient, Container } from '@azure/cosmos';
import { UserDocument } from '../models/user';

export interface ParticipantsCosmosConfig {
  participantsContainerId: string;
  userParticipantLinksContainerId: string;
}

/**
 * Cosmos DB connection settings.
 */
export interface CosmosConfig {
  endpoint: string;
  key: string;
  databaseId: string;
  usersContainerId: string;
  participantsContainerId: string;
  userParticipantLinksContainerId: string;
}

/**
 * Creates a Cosmos client and container map from env or overrides.
 */
export async function buildCosmos(
  config?: Partial<CosmosConfig>
): Promise<{ client: CosmosClient; containers: Record<string, Container> }> {
  const resolved: CosmosConfig = {
    endpoint: process.env.COSMOS_ENDPOINT || '',
    key: process.env.COSMOS_KEY || '',
    databaseId: process.env.COSMOS_DATABASE || 'trackit',
    usersContainerId: process.env.COSMOS_USERS_CONTAINER || 'users',
    participantsContainerId: process.env.COSMOS_PARTICIPANTS_CONTAINER || 'participants',
    userParticipantLinksContainerId: process.env.COSMOS_USER_PARTICIPANT_LINKS_CONTAINER || 'userParticipantLinks',
    ...config
  };

  const client = new CosmosClient({ endpoint: resolved.endpoint, key: resolved.key });
  const { database } = await client.databases.createIfNotExists({ id: resolved.databaseId });
  const { container: usersContainer } = await database.containers.createIfNotExists({
    id: resolved.usersContainerId,
    partitionKey: { paths: ['/id'] }
  });
  const { container: participantsContainer } = await database.containers.createIfNotExists({
    id: resolved.participantsContainerId,
    partitionKey: { paths: ['/id'] }
  });
  const { container: userParticipantLinksContainer } = await database.containers.createIfNotExists({
    id: resolved.userParticipantLinksContainerId,
    partitionKey: { paths: ['/userId'] }
  });
  return {
    client,
    containers: {
      users: usersContainer,
      participants: participantsContainer,
      userParticipantLinks: userParticipantLinksContainer
    }
  };
}

/**
 * Inserts or updates a user document while managing timestamps.
 */
export async function upsertUser(containers: Record<string, Container>, user: UserDocument) {
  const timestamp = new Date().toISOString();
  const existing = user.createdAt;
  const doc: UserDocument = {
    ...user,
    id: user.sub,
    createdAt: existing || timestamp,
    lastLoginAt: timestamp
  };
  await containers.users.items.upsert(doc, { preTriggerInclude: [], postTriggerInclude: [] });
  return doc;
}
