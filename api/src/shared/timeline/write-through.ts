import { Container } from '@azure/cosmos';
import { EventIndexDocument } from '../../models/event-index';

function isProjectionEnabled(): boolean {
  const mode = (process.env.TIMELINE_PROJECTION_MODE || 'write_through').toLowerCase();
  return mode === 'write_through';
}

export async function appendTimelineEvent(
  container: Container,
  event: EventIndexDocument
): Promise<void> {
  if (!isProjectionEnabled()) {
    return;
  }
  await container.items.upsert(event);
}
