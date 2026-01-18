export function buildMedicationLogListQuery(
  participantId: string,
  startDate: string,
  endDate: string,
  medicationIds?: string[]
) {
  const conditions: string[] = [
    'c.participantId = @participantId',
    'c.logLocalDate >= @startDate',
    'c.logLocalDate <= @endDate'
  ];
  const parameters: Array<{ name: string; value: unknown }> = [
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
