import { EventIndexDocument } from '../../models/event-index';

function extractTagValue(tags: string[], prefix: string): string | undefined {
  return tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
}

function medicationLogicalKey(item: EventIndexDocument): string {
  const medicationId = item.summary.medicationId ?? extractTagValue(item.tags, 'medication:');
  const occurrenceKey = item.summary.occurrenceKey ?? extractTagValue(item.tags, 'occurrence:');
  if (medicationId && occurrenceKey) {
    return `medication_log|${item.logLocalDate}|${medicationId}|${occurrenceKey}`;
  }
  return `medication_log|${item.sourceId}`;
}

function projectionKey(item: EventIndexDocument): string {
  if (item.sourceType === 'medication_log') {
    return medicationLogicalKey(item);
  }
  return `${item.sourceType}|${item.sourceId}`;
}

function compareVersions(left: EventIndexDocument, right: EventIndexDocument): number {
  if (left.sourceVersion !== right.sourceVersion) {
    return left.sourceVersion.localeCompare(right.sourceVersion);
  }
  if (left.projectedAtUtc !== right.projectedAtUtc) {
    return left.projectedAtUtc.localeCompare(right.projectedAtUtc);
  }
  return left.id.localeCompare(right.id);
}

function compareProjectedItems(left: EventIndexDocument, right: EventIndexDocument): number {
  if (left.eventAtUtc !== right.eventAtUtc) {
    return right.eventAtUtc.localeCompare(left.eventAtUtc);
  }
  if (left.sourceType !== right.sourceType) {
    return left.sourceType.localeCompare(right.sourceType);
  }
  return left.sourceId.localeCompare(right.sourceId);
}

/**
 * Collapses append-only event index rows into the final state per logical entity for a day window.
 */
export function projectDailyTimelineItems(items: EventIndexDocument[]): EventIndexDocument[] {
  if (items.length < 2) {
    return items.filter((item) => item.operation !== 'delete');
  }

  const latestByKey = new Map<string, EventIndexDocument>();
  for (const item of items) {
    const key = projectionKey(item);
    const existing = latestByKey.get(key);
    if (!existing || compareVersions(item, existing) > 0) {
      latestByKey.set(key, item);
    }
  }

  return Array.from(latestByKey.values())
    .filter((item) => item.operation !== 'delete')
    .sort(compareProjectedItems);
}
