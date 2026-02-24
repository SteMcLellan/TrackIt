import { BehaviorIncidentDocument } from '../../models/behavior-incident';
import { EventIndexDocument, EventOperation } from '../../models/event-index';
import { MedicationLogDocument } from '../../models/medication-log';
import { MedicationDocument } from '../../models/medication';
import { DailyReflectionDocument } from '../../models/daily-reflection';
import { computeUtcFromLocal } from '../validators';
import { medicationDaypartFromLocalTime } from './daypart';
import { reflectionBucketLabel } from './reflection-labels';

export type MedicationProjectionAction = 'created' | 'updated' | 'archived' | 'snapshot';

export const EVENT_INDEX_PROJECTION_VERSION = 2;

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.filter((tag) => tag.trim().length > 0)));
}

function deriveLocalDateTimeFromUtc(isoUtc: string): { logLocalDate: string; logLocalTime: string } {
  const instant = new Date(isoUtc).toISOString();
  return {
    logLocalDate: instant.substring(0, 10),
    logLocalTime: instant.substring(11, 16)
  };
}

function buildBaseEvent(
  input: Omit<EventIndexDocument, 'id' | 'projectionVersion' | 'projectedAtUtc'>
): EventIndexDocument {
  return {
    ...input,
    id: buildEventIndexId(
      input.participantId,
      input.sourceType,
      input.sourceId,
      input.sourceVersion,
      input.operation
    ),
    tags: uniqueTags(input.tags),
    projectionVersion: EVENT_INDEX_PROJECTION_VERSION,
    projectedAtUtc: new Date().toISOString()
  };
}

export function buildEventIndexId(
  participantId: string,
  sourceType: EventIndexDocument['sourceType'],
  sourceId: string,
  sourceVersion: string,
  operation: EventOperation
): string {
  return `evtidx:${participantId}:${sourceType}:${sourceId}:${sourceVersion}:${operation}`;
}

export function projectIncidentToEventIndex(
  incident: BehaviorIncidentDocument,
  operation: EventOperation = 'upsert'
): EventIndexDocument {
  const sourceVersion = incident.updatedAtUtc || incident.createdAtUtc;
  return buildBaseEvent({
    participantId: incident.participantId,
    eventAtUtc: incident.occurredAtUtc,
    logLocalDate: incident.logLocalDate,
    logLocalTime: incident.logLocalTime,
    logTzOffsetMinutes: incident.logTzOffsetMinutes,
    sourceType: 'incident',
    sourceId: incident.id,
    sourceContainer: 'behaviorIncidents',
    sourcePartitionKey: incident.participantId,
    sourceVersion,
    sourceCreatedAtUtc: incident.createdAtUtc,
    sourceUpdatedAtUtc: incident.updatedAtUtc,
    operation,
    tags: [
      'type:incident',
      `function:${incident.function}`,
      `place:${(incident.placeChip || incident.place || 'unknown').toLowerCase().replace(/\s+/g, '_')}`,
      `operation:${operation}`
    ],
    summary: {
      title: 'Behavior incident',
      subtitle: `${incident.function} at ${incident.placeChip || incident.place}`,
      function: incident.function,
      place: incident.placeChip || incident.place
    }
  });
}

export function projectMedicationLogToEventIndex(
  log: MedicationLogDocument,
  medication?: MedicationDocument,
  operation: EventOperation = 'upsert'
): EventIndexDocument {
  const sourceVersion = log.updatedAtUtc || log.createdAtUtc;
  const eventAtUtc = log.takenAtUtc
    ?? (log.logLocalTime
      ? computeUtcFromLocal(log.logLocalDate, log.logLocalTime, log.logTzOffsetMinutes)
      : computeUtcFromLocal(log.logLocalDate, '00:00', log.logTzOffsetMinutes));

  return buildBaseEvent({
    participantId: log.participantId,
    eventAtUtc,
    logLocalDate: log.logLocalDate,
    logLocalTime: log.logLocalTime,
    logTzOffsetMinutes: log.logTzOffsetMinutes,
    sourceType: 'medication_log',
    sourceId: log.id,
    sourceContainer: 'medicationLogs',
    sourcePartitionKey: log.participantId,
    sourceVersion,
    sourceCreatedAtUtc: log.createdAtUtc,
    sourceUpdatedAtUtc: log.updatedAtUtc,
    operation,
    tags: [
      'type:medication_log',
      `status:${log.status}`,
      `medication:${log.medicationId}`,
      `occurrence:${log.occurrenceKey}`,
      `operation:${operation}`
    ],
    summary: {
      title: buildMedicationLogTitle(log.status, medication),
      subtitle: buildMedicationLogSubtitle(log.logLocalTime, medication),
      status: log.status,
      medicationId: log.medicationId,
      medicationName: medication?.name,
      dosageText: medication?.dosageText,
      occurrenceKey: log.occurrenceKey
    }
  });
}

export function projectMedicationToEventIndex(
  medication: MedicationDocument,
  action: MedicationProjectionAction = 'updated',
  operation: EventOperation = 'upsert'
): EventIndexDocument {
  const sourceVersion = medication.updatedAtUtc || medication.createdAtUtc;
  const eventAtUtc = action === 'archived' && medication.archivedAtUtc
    ? medication.archivedAtUtc
    : medication.updatedAtUtc;
  const local = deriveLocalDateTimeFromUtc(eventAtUtc);

  return buildBaseEvent({
    participantId: medication.participantId,
    eventAtUtc,
    logLocalDate: local.logLocalDate,
    logLocalTime: local.logLocalTime,
    logTzOffsetMinutes: 0,
    sourceType: 'medication',
    sourceId: medication.id,
    sourceContainer: 'medications',
    sourcePartitionKey: medication.participantId,
    sourceVersion,
    sourceCreatedAtUtc: medication.createdAtUtc,
    sourceUpdatedAtUtc: medication.updatedAtUtc,
    operation,
    tags: [
      'type:medication',
      `action:${action}`,
      `medication:${medication.id}`,
      `operation:${operation}`
    ],
    summary: {
      title: action === 'created'
        ? 'Medication added'
        : action === 'archived'
          ? 'Medication archived'
          : 'Medication updated',
      subtitle: `${medication.name} • ${medication.dosageText}`,
      medicationId: medication.id,
      medicationName: medication.name
    }
  });
}

function buildMedicationLogSubtitle(
  logLocalTime: string | undefined,
  medication?: MedicationDocument
): string {
  if (medication?.frequency === 'interval-days' && medication.intervalSchedule) {
    const intervalLabel = `Every ${medication.intervalSchedule.intervalDays} days`;
    if (medication.name && medication.dosageText) {
      return `${intervalLabel} • ${medication.name} ${medication.dosageText}`;
    }
    if (medication.name) {
      return `${intervalLabel} • ${medication.name}`;
    }
    return intervalLabel;
  }

  const daypart = logLocalTime ? medicationDaypartFromLocalTime(logLocalTime) : null;
  const daypartLabel = daypart ?? 'Dose logged';

  if (medication?.name && medication?.dosageText) {
    return `${daypartLabel} • ${medication.name} ${medication.dosageText}`;
  }
  if (medication?.name) {
    return `${daypartLabel} • ${medication.name}`;
  }
  return daypartLabel;
}

function buildMedicationLogTitle(
  status: MedicationLogDocument['status'],
  medication?: MedicationDocument
): string {
  if (status !== 'taken') {
    return 'Medication not taken';
  }
  if (medication?.frequency === 'interval-days') {
    return 'Took medication';
  }
  return 'Medication taken';
}

function toLabelTag(dimension: 'mood' | 'focus' | 'energy' | 'sleep', score: number): string {
  return reflectionBucketLabel(dimension, score).toLowerCase().replace(/\s+/g, '_');
}

function buildJournalPreview(note?: string): string | undefined {
  if (!note) {
    return undefined;
  }
  const trimmed = note.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.length > 100 ? `${trimmed.slice(0, 100)}...` : trimmed;
}

export function projectDailyReflectionToEventIndex(
  reflection: DailyReflectionDocument,
  operation: EventOperation = 'upsert'
): EventIndexDocument {
  const sourceVersion = reflection.updatedAtUtc || reflection.createdAtUtc;
  return buildBaseEvent({
    participantId: reflection.participantId,
    eventAtUtc: reflection.updatedAtUtc,
    logLocalDate: reflection.logLocalDate,
    logTzOffsetMinutes: reflection.logTzOffsetMinutes,
    sourceType: 'daily_reflection',
    sourceId: reflection.id,
    sourceContainer: 'dailyReflections',
    sourcePartitionKey: reflection.participantId,
    sourceVersion,
    sourceCreatedAtUtc: reflection.createdAtUtc,
    sourceUpdatedAtUtc: reflection.updatedAtUtc,
    operation,
    tags: [
      'type:daily_reflection',
      `mood_band:${toLabelTag('mood', reflection.moodScore)}`,
      `focus_band:${toLabelTag('focus', reflection.focusScore)}`,
      `energy_band:${toLabelTag('energy', reflection.energyScore)}`,
      `sleep_band:${toLabelTag('sleep', reflection.sleepScore)}`,
      `operation:${operation}`
    ],
    summary: {
      title: 'Daily reflection',
      subtitle: buildJournalPreview(reflection.journalNote),
      moodScore: reflection.moodScore,
      focusScore: reflection.focusScore,
      energyScore: reflection.energyScore,
      sleepScore: reflection.sleepScore,
      journalNotePreview: buildJournalPreview(reflection.journalNote)
    }
  });
}
