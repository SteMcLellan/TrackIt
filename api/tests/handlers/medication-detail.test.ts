import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readMedicationBusinessHandler, updateMedicationBusinessHandler } from '../../src/functions/medication-detail';
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

describe('medication-detail handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('readMedicationBusinessHandler requires medicationId', async () => {
    const response = await readMedicationBusinessHandler(buildContext(), mockHttpRequest({ params: {} }));
    expectValidationErrorIds(response, ['medications.medicationId.required']);
  });

  it('readMedicationBusinessHandler returns 404 when medication missing', async () => {
    const ctx = buildContext();
    (ctx.containers.medications.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null })
    });
    const response = await readMedicationBusinessHandler(
      ctx,
      mockHttpRequest({ params: { medicationId: 'med_1' } })
    );
    expect(response.status).toBe(404);
  });

  it('updateMedicationBusinessHandler returns body invalid', async () => {
    const response = await updateMedicationBusinessHandler(
      buildContext(),
      mockHttpRequest({ method: 'PATCH', params: { medicationId: 'med_1' }, rawBodyString: '{bad-json' })
    );
    expectValidationErrorIds(response, ['medications.body.invalid']);
  });

  it('updateMedicationBusinessHandler rejects legacy frequencyText', async () => {
    const response = await updateMedicationBusinessHandler(
      buildContext(),
      mockHttpRequest({
        method: 'PATCH',
        params: { medicationId: 'med_1' },
        body: { frequencyText: 'legacy' }
      })
    );
    expectValidationErrorIds(response, ['medications.frequencyText.unsupported']);
  });

  it('updateMedicationBusinessHandler returns 404 when medication missing', async () => {
    const ctx = buildContext();
    (ctx.containers.medications.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null })
    });
    const response = await updateMedicationBusinessHandler(
      ctx,
      mockHttpRequest({ method: 'PATCH', params: { medicationId: 'med_1' }, body: { name: 'New' } })
    );
    expect(response.status).toBe(404);
  });

  it('updateMedicationBusinessHandler requires intervalSchedule when switching to interval-days', async () => {
    const ctx = buildContext();
    (ctx.containers.medications.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: {
          id: 'med_1',
          participantId: 'participant_1',
          name: 'Old',
          dosageText: '100mg',
          frequency: 'once-daily',
          startDateUtc: '2026-01-01',
          endDateUtc: null,
          notes: null,
          archivedAtUtc: null,
          createdAtUtc: '2026-01-01T00:00:00.000Z',
          updatedAtUtc: '2026-01-01T00:00:00.000Z'
        }
      })
    });

    const response = await updateMedicationBusinessHandler(
      ctx,
      mockHttpRequest({
        method: 'PATCH',
        params: { medicationId: 'med_1' },
        body: { frequency: 'interval-days' }
      })
    );

    expectValidationErrorIds(response, ['medications.intervalSchedule.required']);
  });

  it('updateMedicationBusinessHandler clears intervalSchedule when switching away from interval-days', async () => {
    const ctx = buildContext();
    (ctx.containers.medications.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: {
          id: 'med_1',
          participantId: 'participant_1',
          name: 'Patch',
          dosageText: '15mg',
          frequency: 'interval-days',
          intervalSchedule: {
            intervalDays: 7,
            anchorDateLocal: '2026-02-10',
            anchorPolicy: 'reset-on-taken'
          },
          startDateUtc: '2026-01-01',
          endDateUtc: null,
          notes: null,
          archivedAtUtc: null,
          createdAtUtc: '2026-01-01T00:00:00.000Z',
          updatedAtUtc: '2026-01-01T00:00:00.000Z'
        }
      })
    });

    const upsertSpy = ctx.containers.medications.items.upsert as unknown as ReturnType<typeof vi.fn>;
    const response = await updateMedicationBusinessHandler(
      ctx,
      mockHttpRequest({
        method: 'PATCH',
        params: { medicationId: 'med_1' },
        body: { frequency: 'once-daily' }
      })
    );

    expect(response.status).toBe(200);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy.mock.calls[0][0].intervalSchedule).toBeNull();
  });

  it('updateMedicationBusinessHandler upserts and appends timeline event', async () => {
    const ctx = buildContext();
    (ctx.containers.medications.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: {
          id: 'med_1',
          participantId: 'participant_1',
          name: 'Old',
          dosageText: '100mg',
          frequency: 'once-daily',
          startDateUtc: '2026-01-01',
          endDateUtc: null,
          notes: null,
          archivedAtUtc: null,
          createdAtUtc: '2026-01-01T00:00:00.000Z',
          updatedAtUtc: '2026-01-01T00:00:00.000Z'
        }
      })
    });
    const upsertSpy = ctx.containers.medications.items.upsert as unknown as ReturnType<typeof vi.fn>;
    const response = await updateMedicationBusinessHandler(
      ctx,
      mockHttpRequest({ method: 'PATCH', params: { medicationId: 'med_1' }, body: { name: ' New ' } })
    );
    expect(response.status).toBe(200);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(vi.mocked(appendTimelineEvent)).toHaveBeenCalledTimes(1);
  });
});

