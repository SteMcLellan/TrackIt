import type { SqlParameter, SqlQuerySpec } from '@azure/cosmos';
import { Container } from '@azure/cosmos';
import { MedicationLogDocument } from '../../models/medication-log';

export function buildMedicationLogListQuery(
  participantId: string,
  startDate: string,
  endDate: string,
  medicationIds?: string[]
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

  if (medicationIds && medicationIds.length > 0) {
    conditions.push('ARRAY_CONTAINS(@medicationIds, c.medicationId)');
    parameters.push({ name: '@medicationIds', value: medicationIds });
  }

  return {
    query: `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.logLocalDate DESC`,
    parameters
  };
}

export async function readMedicationLog(
  container: Container,
  participantId: string,
  logId: string
): Promise<MedicationLogDocument | null> {
  const { resource } = await container.item(logId, participantId).read<MedicationLogDocument>();
  return resource ?? null;
}
