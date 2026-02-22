import { describe, expect, it, vi, beforeEach } from 'vitest';
import { deleteMedicationLogBusinessHandler, readMedicationLogBusinessHandler } from '../../src/functions/medication-log-detail';
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

describe('medication-log-detail handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('readMedicationLogBusinessHandler requires logId', async () => {
    const response = await readMedicationLogBusinessHandler(buildContext(), mockHttpRequest({ params: {} }));
    expectValidationErrorIds(response, ['medicationLogs.logId.required']);
  });

  it('readMedicationLogBusinessHandler returns 404 for missing log', async () => {
    const ctx = buildContext();
    (ctx.containers.medicationLogs.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null })
    });
    const response = await readMedicationLogBusinessHandler(
      ctx,
      mockHttpRequest({ params: { logId: 'log_1' } })
    );
    expect(response.status).toBe(404);
  });

  it('deleteMedicationLogBusinessHandler returns 404 for missing log', async () => {
    const ctx = buildContext();
    (ctx.containers.medicationLogs.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null })
    });
    const response = await deleteMedicationLogBusinessHandler(
      ctx,
      mockHttpRequest({ params: { logId: 'log_1' } })
    );
    expect(response.status).toBe(404);
  });

  it('deleteMedicationLogBusinessHandler deletes log and appends timeline delete', async () => {
    const ctx = buildContext();
    const deleteSpy = vi.fn().mockResolvedValue(undefined);
    (ctx.containers.medicationLogs.item as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        read: vi.fn().mockResolvedValue({
          resource: {
            id: 'log_1',
            participantId: 'participant_1',
            medicationId: 'med_1',
            logLocalDate: '2026-01-01',
            logTzOffsetMinutes: 0,
            status: 'taken',
            occurrenceKey: 'dose-1',
            createdAtUtc: '2026-01-01T00:00:00.000Z',
            updatedAtUtc: '2026-01-01T00:00:00.000Z'
          }
        })
      })
      .mockReturnValueOnce({
        delete: deleteSpy
      });
    (ctx.containers.medications.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null })
    });

    const response = await deleteMedicationLogBusinessHandler(
      ctx,
      mockHttpRequest({ params: { logId: 'log_1' } })
    );
    expect(response.status).toBe(204);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(vi.mocked(appendTimelineEvent)).toHaveBeenCalledTimes(1);
  });
});

