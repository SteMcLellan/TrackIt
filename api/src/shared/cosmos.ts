import { CosmosClient, Container } from '@azure/cosmos';
import { UserDocument } from '../models/user';

export interface ParticipantsCosmosConfig {
  participantsContainerId: string;
  userParticipantLinksContainerId: string;
  participantInvitesContainerId: string;
  behaviorIncidentsContainerId: string;
  medicationsContainerId: string;
  medicationLogsContainerId: string;
  dailyReflectionsContainerId: string;
  eventIndexContainerId: string;
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
  participantInvitesContainerId: string;
  behaviorIncidentsContainerId: string;
  medicationsContainerId: string;
  medicationLogsContainerId: string;
  dailyReflectionsContainerId: string;
  eventIndexContainerId: string;
}

let cachedClient: CosmosClient | null = null;
let cachedContainers: Record<string, Container> | null = null;

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
    participantInvitesContainerId:
      process.env.COSMOS_PARTICIPANT_INVITES_CONTAINER || 'participantInvites',
    behaviorIncidentsContainerId: process.env.COSMOS_BEHAVIOR_INCIDENTS_CONTAINER || 'behaviorIncidents',
    medicationsContainerId: process.env.COSMOS_MEDICATIONS_CONTAINER || 'medications',
    medicationLogsContainerId: process.env.COSMOS_MEDICATION_LOGS_CONTAINER || 'medicationLogs',
    dailyReflectionsContainerId: process.env.COSMOS_DAILY_REFLECTIONS_CONTAINER || 'dailyReflections',
    eventIndexContainerId: process.env.COSMOS_EVENT_INDEX_CONTAINER || 'eventIndex',
    ...config
  };

  if (cachedClient && cachedContainers) {
    return { client: cachedClient, containers: cachedContainers };
  }

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
  const { container: participantInvitesContainer } = await database.containers.createIfNotExists({
    id: resolved.participantInvitesContainerId,
    partitionKey: { paths: ['/participantId'] }
  });
  const { container: behaviorIncidentsContainer } = await database.containers.createIfNotExists({
    id: resolved.behaviorIncidentsContainerId,
    partitionKey: { paths: ['/participantId'] },
    indexingPolicy: {
      compositeIndexes: [
        [
          { path: '/logLocalDate', order: 'descending' },
          { path: '/logLocalTime', order: 'descending' }
        ]
      ]
    }
  });
  const { container: medicationsContainer } = await database.containers.createIfNotExists({
    id: resolved.medicationsContainerId,
    partitionKey: { paths: ['/participantId'] }
  });
  const { container: medicationLogsContainer } = await database.containers.createIfNotExists({
    id: resolved.medicationLogsContainerId,
    partitionKey: { paths: ['/participantId'] }
  });
  const { container: dailyReflectionsContainer } = await database.containers.createIfNotExists({
    id: resolved.dailyReflectionsContainerId,
    partitionKey: { paths: ['/participantId'] },
    indexingPolicy: {
      compositeIndexes: [
        [
          { path: '/logLocalDate', order: 'descending' },
          { path: '/updatedAtUtc', order: 'descending' }
        ]
      ]
    }
  });
  const { container: eventIndexContainer } = await database.containers.createIfNotExists({
    id: resolved.eventIndexContainerId,
    partitionKey: { paths: ['/participantId'] },
    indexingPolicy: {
      compositeIndexes: [
        [
          { path: '/eventAtUtc', order: 'ascending' },
          { path: '/sourceType', order: 'ascending' }
        ],
        [
          { path: '/sourceType', order: 'ascending' },
          { path: '/eventAtUtc', order: 'ascending' }
        ],
        [
          { path: '/logLocalDate', order: 'ascending' },
          { path: '/eventAtUtc', order: 'ascending' }
        ]
      ]
    }
  });

  cachedClient = client;
  cachedContainers = {
    users: usersContainer,
    participants: participantsContainer,
    userParticipantLinks: userParticipantLinksContainer,
    participantInvites: participantInvitesContainer,
    behaviorIncidents: behaviorIncidentsContainer,
    medications: medicationsContainer,
    medicationLogs: medicationLogsContainer,
    dailyReflections: dailyReflectionsContainer,
    eventIndex: eventIndexContainer
  };

  return {
    client,
    containers: cachedContainers
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
