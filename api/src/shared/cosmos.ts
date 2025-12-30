import { CosmosClient, Container } from '@azure/cosmos';
import { UserDocument } from '../models/user';

export interface CosmosConfig {
  endpoint: string;
  key: string;
  databaseId: string;
  usersContainerId: string;
}

export function buildCosmos(config?: Partial<CosmosConfig>): { client: CosmosClient; containers: Record<string, Container> } {
  const resolved: CosmosConfig = {
    endpoint: process.env.COSMOS_ENDPOINT || '',
    key: process.env.COSMOS_KEY || '',
    databaseId: process.env.COSMOS_DATABASE || 'trackit',
    usersContainerId: process.env.COSMOS_USERS_CONTAINER || 'users',
    ...config
  };

  const client = new CosmosClient({ endpoint: resolved.endpoint, key: resolved.key });
  const database = client.database(resolved.databaseId);
  return {
    client,
    containers: {
      users: database.container(resolved.usersContainerId)
    }
  };
}

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
