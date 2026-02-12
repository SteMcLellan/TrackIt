import type { SqlParameter, SqlQuerySpec } from '@azure/cosmos';
import { Container } from '@azure/cosmos';
import { DailyReflectionDocument } from '../../models/daily-reflection';

export function buildDailyReflectionListQuery(
  participantId: string,
  startDate: string,
  endDate: string
): SqlQuerySpec {
  const conditions: string[] = [
    'c.participantId = @participantId',
    'c.logLocalDate >= @startDate',
    'c.logLocalDate <= @endDate'
  ];
  const parameters: SqlParameter[] = [
    { name: '@participantId', value: participantId },
    { name: '@startDate', value: startDate },
    { name: '@endDate', value: endDate }
  ];

  return {
    query: `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.logLocalDate DESC`,
    parameters
  };
}

export async function readDailyReflection(
  container: Container,
  participantId: string,
  reflectionId: string
): Promise<DailyReflectionDocument | null> {
  const { resource } = await container.item(reflectionId, participantId).read<DailyReflectionDocument>();
  return resource ?? null;
}
