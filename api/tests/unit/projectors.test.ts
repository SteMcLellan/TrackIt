import { describe, expect, it } from 'vitest';
import {
  projectMedicationLogToEventIndex,
  projectDailyReflectionToEventIndex,
  EVENT_INDEX_PROJECTION_VERSION
} from '../../src/shared/timeline/projectors';
import { MedicationLogDocument } from '../../src/models/medication-log';
import { MedicationDocument } from '../../src/models/medication';
import { DailyReflectionDocument } from '../../src/models/daily-reflection';

function baseMedLog(overrides?: Partial<MedicationLogDocument>): MedicationLogDocument {
  return {
    id: 'medlog_med1_2026-02-14_dose-1',
    participantId: 'p1',
    medicationId: 'med1',
    logLocalDate: '2026-02-14',
    logLocalTime: '08:30',
    logTzOffsetMinutes: -300,
    takenAtUtc: '2026-02-14T13:30:00.000Z',
    occurrenceKey: 'dose-1',
    status: 'taken',
    createdAtUtc: '2026-02-14T13:30:00.000Z',
    updatedAtUtc: '2026-02-14T13:30:00.000Z',
    ...overrides
  };
}

function baseMedication(overrides?: Partial<MedicationDocument>): MedicationDocument {
  return {
    id: 'med1',
    participantId: 'p1',
    name: 'Methylphenidate',
    dosageText: '10mg',
    frequency: 'once-daily',
    startDateUtc: '2026-01-01',
    createdAtUtc: '2026-01-01T00:00:00.000Z',
    updatedAtUtc: '2026-01-01T00:00:00.000Z',
    ...overrides
  } as MedicationDocument;
}

function baseReflection(overrides?: Partial<DailyReflectionDocument>): DailyReflectionDocument {
  return {
    id: 'refl:p1:2026-02-14',
    participantId: 'p1',
    logLocalDate: '2026-02-14',
    logTzOffsetMinutes: -300,
    moodScore: 70,
    focusScore: 30,
    energyScore: 50,
    sleepScore: 90,
    createdAtUtc: '2026-02-14T22:00:00.000Z',
    updatedAtUtc: '2026-02-14T22:00:00.000Z',
    createdByUserId: 'user1',
    updatedByUserId: 'user1',
    ...overrides
  };
}

describe('EVENT_INDEX_PROJECTION_VERSION', () => {
  it('is 2', () => {
    expect(EVENT_INDEX_PROJECTION_VERSION).toBe(2);
  });
});

describe('projectMedicationLogToEventIndex', () => {
  it('builds subtitle with daypart, medication name and dosageText', () => {
    const result = projectMedicationLogToEventIndex(baseMedLog(), baseMedication());
    expect(result.summary.subtitle).toBe('Morning • Methylphenidate 10mg');
    expect(result.summary.dosageText).toBe('10mg');
  });

  it('builds subtitle with medication name only when dosageText is missing', () => {
    const result = projectMedicationLogToEventIndex(
      baseMedLog(),
      baseMedication({ dosageText: undefined })
    );
    expect(result.summary.subtitle).toBe('Morning • Methylphenidate');
  });

  it('falls back to daypart only when no medication is provided', () => {
    const result = projectMedicationLogToEventIndex(baseMedLog());
    expect(result.summary.subtitle).toBe('Morning');
  });

  it('uses "Dose logged" when logLocalTime is undefined', () => {
    const result = projectMedicationLogToEventIndex(
      baseMedLog({ logLocalTime: undefined }),
      baseMedication()
    );
    expect(result.summary.subtitle).toBe('Dose logged • Methylphenidate 10mg');
  });

  it('uses "Dose logged" with no medication and no logLocalTime', () => {
    const result = projectMedicationLogToEventIndex(
      baseMedLog({ logLocalTime: undefined })
    );
    expect(result.summary.subtitle).toBe('Dose logged');
  });
});

describe('projectDailyReflectionToEventIndex', () => {
  it('uses dimension-specific labels in tags', () => {
    const result = projectDailyReflectionToEventIndex(baseReflection());
    expect(result.tags).toContain('mood_band:upbeat');
    expect(result.tags).toContain('focus_band:drifting');
    expect(result.tags).toContain('energy_band:steady');
    expect(result.tags).toContain('sleep_band:refreshed');
  });

  it('does not use generic band names in tags', () => {
    const result = projectDailyReflectionToEventIndex(baseReflection());
    for (const tag of result.tags) {
      expect(tag).not.toMatch(/:very_low$/);
      expect(tag).not.toMatch(/:low$/);
      expect(tag).not.toMatch(/:medium$/);
      expect(tag).not.toMatch(/:high$/);
    }
  });

  it('uses journal preview as subtitle when journal note exists', () => {
    const result = projectDailyReflectionToEventIndex(
      baseReflection({ journalNote: 'Had a great day at school today.' })
    );
    expect(result.summary.subtitle).toBe('Had a great day at school today.');
  });

  it('truncates long journal notes in subtitle', () => {
    const longNote = 'A'.repeat(150);
    const result = projectDailyReflectionToEventIndex(
      baseReflection({ journalNote: longNote })
    );
    expect(result.summary.subtitle).toBe('A'.repeat(100) + '...');
  });

  it('sets subtitle to undefined when no journal note', () => {
    const result = projectDailyReflectionToEventIndex(
      baseReflection({ journalNote: undefined })
    );
    expect(result.summary.subtitle).toBeUndefined();
  });

  it('preserves raw scores in summary fields', () => {
    const result = projectDailyReflectionToEventIndex(baseReflection());
    expect(result.summary.moodScore).toBe(70);
    expect(result.summary.focusScore).toBe(30);
    expect(result.summary.energyScore).toBe(50);
    expect(result.summary.sleepScore).toBe(90);
  });

  it('uses correct boundaries for edge scores', () => {
    const result = projectDailyReflectionToEventIndex(
      baseReflection({ moodScore: 19, focusScore: 20, energyScore: 79, sleepScore: 80 })
    );
    expect(result.tags).toContain('mood_band:struggling');
    expect(result.tags).toContain('focus_band:drifting');
    expect(result.tags).toContain('energy_band:buzzing');
    expect(result.tags).toContain('sleep_band:refreshed');
  });
});
