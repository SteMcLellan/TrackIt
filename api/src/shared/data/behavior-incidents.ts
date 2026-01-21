import { Container } from '@azure/cosmos';
import { BehaviorFunction, BehaviorIncidentDocument } from '../../models/behavior-incident';

export function buildBehaviorIncidentListQuery(
  participantId: string,
  functionFilter?: BehaviorFunction,
  startDate?: string,
  endDate?: string
) {
  const conditions: string[] = ['c.participantId = @participantId'];
  const parameters = [{ name: '@participantId', value: participantId }];

  if (functionFilter) {
    conditions.push('c.function = @function');
    parameters.push({ name: '@function', value: functionFilter });
  }
  if (startDate) {
    conditions.push('c.logLocalDate >= @startDate');
    parameters.push({ name: '@startDate', value: startDate });
  }
  if (endDate) {
    conditions.push('c.logLocalDate <= @endDate');
    parameters.push({ name: '@endDate', value: endDate });
  }

  return {
    query: `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.logLocalDate DESC, c.logLocalTime DESC`,
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
