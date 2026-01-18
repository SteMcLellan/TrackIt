import { Container } from '@azure/cosmos';
import { MedicationDocument } from '../../models/medication';

export function buildMedicationListQuery(participantId: string, includeArchived: boolean) {
  const conditions: string[] = ['c.participantId = @participantId'];
  const parameters = [{ name: '@participantId', value: participantId }];

  if (!includeArchived) {
    conditions.push('IS_NULL(c.archivedAtUtc)');
  }

  return {
    query: `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.startDateUtc DESC`,
    parameters
  };
}

export async function readMedication(
  container: Container,
  participantId: string,
  medicationId: string
): Promise<MedicationDocument | null> {
  const { resource } = await container.item(medicationId, participantId).read<MedicationDocument>();
  return resource ?? null;
}
