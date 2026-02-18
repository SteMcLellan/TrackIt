import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockHttpRequest } from '../helpers/http';
import { mockInvocationContext } from '../helpers/context';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';

const authorizeMock = vi.fn();
const buildCosmosMock = vi.fn();
const readParticipantLinkMock = vi.fn();
const readMedicationMock = vi.fn();
const appendTimelineEventMock = vi.fn();

vi.mock('../../src/shared/authorize', () => ({
  authorize: (...args: unknown[]) => authorizeMock(...args)
}));

vi.mock('../../src/shared/cosmos', () => ({
  buildCosmos: (...args: unknown[]) => buildCosmosMock(...args)
}));

vi.mock('../../src/shared/data/participants', () => ({
  readParticipantLink: (...args: unknown[]) => readParticipantLinkMock(...args)
}));

vi.mock('../../src/shared/data/medications', async () => {
  const actual = await vi.importActual('../../src/shared/data/medications');
  return {
    ...(actual as object),
    readMedication: (...args: unknown[]) => readMedicationMock(...args)
  };
});

vi.mock('../../src/shared/timeline/write-through', () => ({
  appendTimelineEvent: (...args: unknown[]) => appendTimelineEventMock(...args)
}));

import {
  listMedicationLogsHandler,
  upsertMedicationLogHandler,
  createAsNeededMedicationLogHandler
} from '../../src/functions/medication-logs';

describe('medication-logs handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeMock.mockReturnValue({ sub: 'user-1', iat: 1, exp: 2 });
    readParticipantLinkMock.mockResolvedValue({
      id: 'user-1:participant_1',
      userId: 'user-1',
      participantId: 'participant_1',
      role: 'manager',
      createdAt: '2026-01-01T00:00:00.000Z'
    });
  });

  it('listMedicationLogsHandler validates date filters', async () => {
    const containers = createCosmosContainersStub();
    buildCosmosMock.mockResolvedValue({ containers });

    const response = await listMedicationLogsHandler(
      mockHttpRequest({
        params: { participantId: 'participant_1' },
        query: { startDate: 'bad', endDate: 'bad' }
      }),
      mockInvocationContext()
    );

    expect(response.status).toBe(400);
  });

  it('listMedicationLogsHandler returns paged items', async () => {
    const containers = createCosmosContainersStub();
    (containers.medicationLogs.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchNext: vi.fn().mockResolvedValue({ resources: [{ id: 'log_1' }], continuationToken: 'next' })
    });
    buildCosmosMock.mockResolvedValue({ containers });

    const response = await listMedicationLogsHandler(
      mockHttpRequest({
        params: { participantId: 'participant_1' },
        query: { startDate: '2026-01-01', endDate: '2026-01-01' }
      }),
      mockInvocationContext()
    );

    expect(response.status).toBe(200);
    expect((response.jsonBody as { nextToken: string | null }).nextToken).toBe('next');
  });

  it('upsertMedicationLogHandler requires occurrenceKey', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const containers = createCosmosContainersStub();
    readMedicationMock.mockResolvedValue({
      id: 'med_1',
      participantId: 'participant_1',
      frequency: 'once-daily',
      startDateUtc: '2026-01-01',
      endDateUtc: null,
      name: 'Med',
      dosageText: '100mg',
      archivedAtUtc: null,
      createdAtUtc: '2026-01-01T00:00:00.000Z',
      updatedAtUtc: '2026-01-01T00:00:00.000Z'
    });
    buildCosmosMock.mockResolvedValue({ containers });

    const response = await upsertMedicationLogHandler(
      mockHttpRequest({
        method: 'PUT',
        params: { participantId: 'participant_1', medicationId: 'med_1', logLocalDate: today },
        body: { status: 'taken', logTzOffsetMinutes: 0 }
      }),
      mockInvocationContext()
    );

    expect(response.status).toBe(400);
    expect(((response.jsonBody as { errors?: Array<{ id: string }> }).errors ?? [])[0]?.id).toBe(
      'medicationLogs.occurrence.required'
    );
  });

  it('upsertMedicationLogHandler upserts and appends event', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const containers = createCosmosContainersStub();
    (containers.medicationLogs.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null })
    });
    readMedicationMock.mockResolvedValue({
      id: 'med_1',
      participantId: 'participant_1',
      frequency: 'once-daily',
      startDateUtc: '2026-01-01',
      endDateUtc: null,
      name: 'Med',
      dosageText: '100mg',
      archivedAtUtc: null,
      createdAtUtc: '2026-01-01T00:00:00.000Z',
      updatedAtUtc: '2026-01-01T00:00:00.000Z'
    });
    buildCosmosMock.mockResolvedValue({ containers });

    const response = await upsertMedicationLogHandler(
      mockHttpRequest({
        method: 'PUT',
        params: { participantId: 'participant_1', medicationId: 'med_1', logLocalDate: today },
        body: { status: 'taken', logTzOffsetMinutes: 0, occurrenceKey: 'dose-1' }
      }),
      mockInvocationContext()
    );

    expect(response.status).toBe(200);
    expect((containers.medicationLogs.items.upsert as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect(appendTimelineEventMock).toHaveBeenCalledTimes(1);
  });

  it('createAsNeededMedicationLogHandler rejects non as-needed frequency', async () => {
    const containers = createCosmosContainersStub();
    readMedicationMock.mockResolvedValue({
      id: 'med_1',
      participantId: 'participant_1',
      frequency: 'once-daily',
      startDateUtc: '2026-01-01',
      endDateUtc: null,
      name: 'Med',
      dosageText: '100mg',
      archivedAtUtc: null,
      createdAtUtc: '2026-01-01T00:00:00.000Z',
      updatedAtUtc: '2026-01-01T00:00:00.000Z'
    });
    buildCosmosMock.mockResolvedValue({ containers });

    const response = await createAsNeededMedicationLogHandler(
      mockHttpRequest({
        method: 'POST',
        params: { participantId: 'participant_1', medicationId: 'med_1', logLocalDate: '2026-01-02' },
        body: { logTzOffsetMinutes: 0 }
      }),
      mockInvocationContext()
    );

    expect(response.status).toBe(400);
    expect(((response.jsonBody as { errors?: Array<{ id: string }> }).errors ?? [])[0]?.id).toBe(
      'medicationLogs.frequency.route.invalid'
    );
  });
});
