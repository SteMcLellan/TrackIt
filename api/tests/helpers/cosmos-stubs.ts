import { vi } from 'vitest';
import { CosmosContainers } from '../../src/shared/cosmos';

function createContainerStub() {
  const create = vi.fn();
  const upsert = vi.fn();
  const queryFetchNext = vi.fn();
  const query = vi.fn().mockReturnValue({ fetchNext: queryFetchNext });
  const read = vi.fn().mockResolvedValue({ resource: null });
  const replace = vi.fn();
  const remove = vi.fn();
  const item = vi.fn().mockReturnValue({ read, replace, delete: remove });

  return {
    items: {
      create,
      upsert,
      query
    },
    item
  };
}

export function createCosmosContainersStub(): CosmosContainers {
  return {
    users: createContainerStub() as unknown as CosmosContainers['users'],
    participants: createContainerStub() as unknown as CosmosContainers['participants'],
    userParticipantLinks: createContainerStub() as unknown as CosmosContainers['userParticipantLinks'],
    participantInvites: createContainerStub() as unknown as CosmosContainers['participantInvites'],
    behaviorIncidents: createContainerStub() as unknown as CosmosContainers['behaviorIncidents'],
    medications: createContainerStub() as unknown as CosmosContainers['medications'],
    medicationLogs: createContainerStub() as unknown as CosmosContainers['medicationLogs'],
    dailyReflections: createContainerStub() as unknown as CosmosContainers['dailyReflections'],
    eventIndex: createContainerStub() as unknown as CosmosContainers['eventIndex']
  };
}
