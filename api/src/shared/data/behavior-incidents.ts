import { Container } from '@azure/cosmos';
import { BehaviorFunction, BehaviorIncidentDocument } from '../../models/behavior-incident';

export function buildBehaviorIncidentListQuery(
  participantId: string,
  functionFilter?: BehaviorFunction,
  fromUtc?: string,
  toUtc?: string
) {
  const conditions: string[] = ['c.participantId = @participantId'];
  const parameters = [{ name: '@participantId', value: participantId }];

  if (functionFilter) {
    conditions.push('c.function = @function');
    parameters.push({ name: '@function', value: functionFilter });
  }
  if (fromUtc) {
    conditions.push('c.occurredAtUtc >= @fromUtc');
    parameters.push({ name: '@fromUtc', value: fromUtc });
  }
  if (toUtc) {
    conditions.push('c.occurredAtUtc <= @toUtc');
    parameters.push({ name: '@toUtc', value: toUtc });
  }

  return {
    query: `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.occurredAtUtc DESC`,
    parameters
  };
}

export async function readBehaviorIncident(
  container: Container,
  participantId: string,
  incidentId: string
): Promise<BehaviorIncidentDocument | null> {
  const { resource } = await container.item(incidentId, participantId).read<BehaviorIncidentDocument>();
  return resource ?? null;
}
