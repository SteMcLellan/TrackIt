import { describe, expect, it } from 'vitest';
import { validateCreateRequest } from '../../src/functions/medications';

describe('validateCreateRequest', () => {
  it('returns no errors for a valid payload', () => {
    const errors = validateCreateRequest({
      name: 'Ibuprofen',
      dosageText: '200mg',
      frequency: 'once-daily',
      startDateUtc: '2026-02-01',
      endDateUtc: '2026-02-15',
      notes: 'With food'
    });
    expect(errors).toEqual([]);
  });

  it('returns required field errors', () => {
    const errors = validateCreateRequest({
      name: '  ',
      dosageText: '',
      frequency: '',
      startDateUtc: '2026-02-01'
    });

    expect(errors.map((error) => error.id)).toEqual([
      'medications.name.required',
      'medications.dosage.required',
      'medications.frequency.required'
    ]);
  });

  it('returns frequency invalid when value is unsupported', () => {
    const errors = validateCreateRequest({
      name: 'Ibuprofen',
      dosageText: '200mg',
      frequency: 'every-hour',
      startDateUtc: '2026-02-01'
    });

    expect(errors.map((error) => error.id)).toContain('medications.frequency.invalid');
  });

  it('returns date format errors', () => {
    const errors = validateCreateRequest({
      name: 'Ibuprofen',
      dosageText: '200mg',
      frequency: 'once-daily',
      startDateUtc: '2026/02/01',
      endDateUtc: 'bad-date'
    });

    expect(errors.map((error) => error.id)).toEqual([
      'medications.startDate.invalid',
      'medications.endDate.invalid'
    ]);
  });

  it('returns range error when end date is before start date', () => {
    const errors = validateCreateRequest({
      name: 'Ibuprofen',
      dosageText: '200mg',
      frequency: 'once-daily',
      startDateUtc: '2026-02-10',
      endDateUtc: '2026-02-01'
    });

    expect(errors.map((error) => error.id)).toContain('medications.dateRange.invalid');
  });
});
