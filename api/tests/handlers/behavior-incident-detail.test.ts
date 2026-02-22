import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readBehaviorIncidentBusinessHandler,
  updateBehaviorIncidentBusinessHandler,
  deleteBehaviorIncidentBusinessHandler
} from '../../src/functions/behavior-incident-detail';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';
import { mockHttpRequest } from '../helpers/http';
import { expectValidationErrorIds } from '../helpers/assertions';
import { ParticipantContext } from '../../src/shared/handler-context';
import { appendTimelineEvent } from '../../src/shared/timeline/write-through';

vi.mock('../../src/shared/timeline/write-through', () => ({
  appendTimelineEvent: vi.fn().mockResolvedValue(undefined)
}));

function buildContext(): ParticipantContext {
  return {
    user: { sub: 'user-1', iat: 1, exp: 2 },
    containers: createCosmosContainersStub(),
    participantId: 'participant_1',
    link: {
      id: 'user-1:participant_1',
      userId: 'user-1',
      participantId: 'participant_1',
      role: 'manager',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  };
}

describe('behavior-incident-detail handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('readBehaviorIncidentBusinessHandler requires incident id', async () => {
    const response = await readBehaviorIncidentBusinessHandler(buildContext(), mockHttpRequest({ params: {} }));
    expectValidationErrorIds(response, ['incidents.incidentId.required']);
  });

  it('readBehaviorIncidentBusinessHandler returns 404 when missing', async () => {
    const ctx = buildContext();
    (ctx.containers.behaviorIncidents.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null })
    });
    const response = await readBehaviorIncidentBusinessHandler(
      ctx,
      mockHttpRequest({ params: { incidentId: 'incident_1' } })
    );
    expect(response.status).toBe(404);
  });

  it('updateBehaviorIncidentBusinessHandler validates request body', async () => {
    const response = await updateBehaviorIncidentBusinessHandler(
      buildContext(),
      mockHttpRequest({ method: 'PATCH', params: { incidentId: 'incident_1' }, body: {} })
    );
    expectValidationErrorIds(response, ['incidents.update.empty']);
  });

  it('updateBehaviorIncidentBusinessHandler returns 404 for unknown incident', async () => {
    const ctx = buildContext();
    (ctx.containers.behaviorIncidents.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null })
    });
    const response = await updateBehaviorIncidentBusinessHandler(
      ctx,
      mockHttpRequest({ method: 'PATCH', params: { incidentId: 'incident_1' }, body: { antecedent: 'x' } })
    );
    expect(response.status).toBe(404);
  });

  it('updateBehaviorIncidentBusinessHandler upserts and appends timeline event', async () => {
    const ctx = buildContext();
    (ctx.containers.behaviorIncidents.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: {
          id: 'incident_1',
          participantId: 'participant_1',
          antecedent: 'A',
          behavior: 'B',
          consequence: 'C',
          occurredAtUtc: '2026-02-01T10:00:00.000Z',
          logLocalDate: '2026-02-01',
          logLocalTime: '10:00',
          logTzOffsetMinutes: 0,
          place: 'Home',
          function: 'attention',
          createdAtUtc: '2026-02-01T10:00:00.000Z',
          createdByUserId: 'user-1'
        }
      })
    });
    const upsertSpy = ctx.containers.behaviorIncidents.items.upsert as unknown as ReturnType<typeof vi.fn>;
    const response = await updateBehaviorIncidentBusinessHandler(
      ctx,
      mockHttpRequest({ method: 'PATCH', params: { incidentId: 'incident_1' }, body: { place: 'School' } })
    );
    expect(response.status).toBe(200);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(vi.mocked(appendTimelineEvent)).toHaveBeenCalledTimes(1);
  });

  it('deleteBehaviorIncidentBusinessHandler deletes incident and appends delete event', async () => {
    const ctx = buildContext();
    const deleteSpy = vi.fn().mockResolvedValue(undefined);
    (ctx.containers.behaviorIncidents.item as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        read: vi.fn().mockResolvedValue({
          resource: {
            id: 'incident_1',
            participantId: 'participant_1',
            antecedent: 'A',
            behavior: 'B',
            consequence: 'C',
            occurredAtUtc: '2026-02-01T10:00:00.000Z',
            logLocalDate: '2026-02-01',
            logLocalTime: '10:00',
            logTzOffsetMinutes: 0,
            place: 'Home',
            function: 'attention',
            createdAtUtc: '2026-02-01T10:00:00.000Z',
            createdByUserId: 'user-1'
          }
        })
      })
      .mockReturnValueOnce({
        delete: deleteSpy
      });
    const response = await deleteBehaviorIncidentBusinessHandler(
      ctx,
      mockHttpRequest({ params: { incidentId: 'incident_1' } })
    );
    expect(response.status).toBe(204);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(vi.mocked(appendTimelineEvent)).toHaveBeenCalledTimes(1);
  });
});

