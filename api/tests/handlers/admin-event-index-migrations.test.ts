import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockHttpRequest } from '../helpers/http';
import { mockInvocationContext } from '../helpers/context';

const authorizeMock = vi.fn();
const buildCosmosMock = vi.fn();
const projectIncidentToEventIndexMock = vi.fn();
const projectMedicationLogToEventIndexMock = vi.fn();
const projectMedicationToEventIndexMock = vi.fn();
const projectDailyReflectionToEventIndexMock = vi.fn();

vi.mock('../../src/shared/authorize', () => ({
  authorize: (...args: unknown[]) => authorizeMock(...args)
}));

vi.mock('../../src/shared/cosmos', () => ({
  buildCosmos: (...args: unknown[]) => buildCosmosMock(...args)
}));

vi.mock('../../src/shared/timeline/projectors', () => ({
  projectIncidentToEventIndex: (...args: unknown[]) => projectIncidentToEventIndexMock(...args),
  projectMedicationLogToEventIndex: (...args: unknown[]) => projectMedicationLogToEventIndexMock(...args),
  projectMedicationToEventIndex: (...args: unknown[]) => projectMedicationToEventIndexMock(...args),
  projectDailyReflectionToEventIndex: (...args: unknown[]) => projectDailyReflectionToEventIndexMock(...args)
}));

import { adminBackfillTimelineHandler, adminVerifyTimelineHandler } from '../../src/functions/admin-event-index-migrations';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';

function buildAdminContainers() {
  const containers = createCosmosContainersStub();
  const incidentDoc = {
    id: 'incident_1',
    participantId: 'participant_1',
    sourceType: 'incident',
    sourceId: 'incident_1',
    sourceVersion: 'v1'
  };
  (containers.behaviorIncidents.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    fetchNext: vi.fn().mockResolvedValue({ resources: [incidentDoc], continuationToken: null })
  });
  return containers;
}

describe('admin event-index migrations handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildCosmosMock.mockResolvedValue({ containers: createCosmosContainersStub() });
    projectIncidentToEventIndexMock.mockReturnValue({
      id: 'evt_incident_1',
      participantId: 'participant_1',
      sourceType: 'incident',
      sourceId: 'incident_1',
      sourceVersion: 'v1'
    });
    projectMedicationLogToEventIndexMock.mockReturnValue({
      id: 'evt_medlog_1',
      participantId: 'participant_1',
      sourceType: 'medication_log',
      sourceId: 'medlog_1',
      sourceVersion: 'v1'
    });
    projectMedicationToEventIndexMock.mockReturnValue({
      id: 'evt_med_1',
      participantId: 'participant_1',
      sourceType: 'medication',
      sourceId: 'med_1',
      sourceVersion: 'v1'
    });
    projectDailyReflectionToEventIndexMock.mockReturnValue({
      id: 'evt_dr_1',
      participantId: 'participant_1',
      sourceType: 'daily_reflection',
      sourceId: 'daily_1',
      sourceVersion: 'v1'
    });
  });

  it('returns 403 when caller is not admin', async () => {
    authorizeMock.mockReturnValue({ sub: 'user-1' });
    const response = await adminBackfillTimelineHandler(
      mockHttpRequest({ method: 'POST', body: {} }),
      mockInvocationContext()
    );
    expect(response.status).toBe(403);
  });

  it('returns validation error for invalid include source', async () => {
    authorizeMock.mockReturnValue({ sub: 'user-1', metadata: { roles: ['admin'] } });
    const response = await adminBackfillTimelineHandler(
      mockHttpRequest({ method: 'POST', body: { include: ['bad'] } }),
      mockInvocationContext()
    );
    expect(response.status).toBe(400);
  });

  it('supports backfill dryRun without writing to eventIndex', async () => {
    authorizeMock.mockReturnValue({ sub: 'user-1', metadata: { roles: ['admin'] } });
    const containers = buildAdminContainers();
    const upsertSpy = containers.eventIndex.items.upsert as unknown as ReturnType<typeof vi.fn>;
    buildCosmosMock.mockResolvedValue({ containers });

    const response = await adminBackfillTimelineHandler(
      mockHttpRequest({ method: 'POST', body: { dryRun: true, include: ['incidents'], maxItems: 1 } }),
      mockInvocationContext()
    );

    expect(response.status).toBe(200);
    expect((response.jsonBody as { projected: number }).projected).toBe(1);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('verifies projected events and reports matched', async () => {
    authorizeMock.mockReturnValue({ sub: 'user-1', metadata: { roles: ['admin'] } });
    const containers = buildAdminContainers();
    (containers.eventIndex.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: {
          id: 'evt_incident_1',
          sourceId: 'incident_1',
          sourceVersion: 'v1'
        }
      })
    });
    buildCosmosMock.mockResolvedValue({ containers });

    const response = await adminVerifyTimelineHandler(
      mockHttpRequest({ method: 'POST', body: { include: ['incidents'], maxItems: 1 } }),
      mockInvocationContext()
    );

    expect(response.status).toBe(200);
    expect((response.jsonBody as { matched: number; missing: number; mismatched: number }).matched).toBe(1);
  });
});
