import { describe, expect, it } from 'vitest';
import { buildMedicationListQuery } from '../../src/shared/data/medications';

describe('buildMedicationListQuery', () => {
  it('adds archived filter when includeArchived is false', () => {
    const query = buildMedicationListQuery('participant-1', false);
    expect(query.query).toContain('IS_NULL(c.archivedAtUtc)');
    expect(query.parameters).toEqual([{ name: '@participantId', value: 'participant-1' }]);
  });

  it('omits archived filter when includeArchived is true', () => {
    const query = buildMedicationListQuery('participant-1', true);
    expect(query.query).not.toContain('IS_NULL(c.archivedAtUtc)');
    expect(query.parameters).toEqual([{ name: '@participantId', value: 'participant-1' }]);
  });
});
