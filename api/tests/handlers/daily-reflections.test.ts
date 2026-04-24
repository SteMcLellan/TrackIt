import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockHttpRequest } from '../helpers/http';
import { mockInvocationContext } from '../helpers/context';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';

const authorizeMock = vi.fn();
const buildCosmosMock = vi.fn();
const resolveClerkIdentityBySubMock = vi.fn();
const upsertUserMock = vi.fn();
const readParticipantLinkMock = vi.fn();
const readDailyReflectionMock = vi.fn();
const appendTimelineEventMock = vi.fn();

vi.mock('../../src/shared/authorize', () => ({
  authorize: (...args: unknown[]) => authorizeMock(...args)
}));

vi.mock('../../src/shared/cosmos', () => ({
  buildCosmos: (...args: unknown[]) => buildCosmosMock(...args),
  upsertUser: (...args: unknown[]) => upsertUserMock(...args)
}));

vi.mock('../../src/shared/auth', async () => {
  const actual = await vi.importActual('../../src/shared/auth');
  return {
    ...(actual as object),
    resolveClerkIdentityBySub: (...args: unknown[]) => resolveClerkIdentityBySubMock(...args)
  };
});

vi.mock('../../src/shared/data/participants', () => ({
  readParticipantLink: (...args: unknown[]) => readParticipantLinkMock(...args)
}));

vi.mock('../../src/shared/data/daily-reflections', async () => {
  const actual = await vi.importActual('../../src/shared/data/daily-reflections');
  return {
    ...(actual as object),
    readDailyReflection: (...args: unknown[]) => readDailyReflectionMock(...args)
  };
});

vi.mock('../../src/shared/timeline/write-through', () => ({
  appendTimelineEvent: (...args: unknown[]) => appendTimelineEventMock(...args)
}));

import {
  listDailyReflectionsHandler,
  upsertDailyReflectionHandler,
  dailyReflectionsSummaryHandler
} from '../../src/functions/daily-reflections';

describe('daily-reflections handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeMock.mockReturnValue({ sub: 'user-1', iat: 1, exp: 2 });
    resolveClerkIdentityBySubMock.mockResolvedValue({
      sub: 'user-1',
      email: 'user-1@example.com',
      name: 'User One'
    });
    readParticipantLinkMock.mockResolvedValue({
      id: 'user-1:participant_1',
      userId: 'user-1',
      participantId: 'participant_1',
      role: 'manager',
      createdAtUtc: '2026-01-01T00:00:00.000Z'
    });
  });

  it('listDailyReflectionsHandler validates date range params', async () => {
    const containers = createCosmosContainersStub();
    buildCosmosMock.mockResolvedValue({ containers });
    const response = await listDailyReflectionsHandler(
      mockHttpRequest({
        params: { participantId: 'participant_1' },
        query: { startDate: 'bad', endDate: 'bad' }
      }),
      mockInvocationContext()
    );
    expect(response.status).toBe(400);
  });

  it('listDailyReflectionsHandler enforces participant middleware param check', async () => {
    const containers = createCosmosContainersStub();
    buildCosmosMock.mockResolvedValue({ containers });
    const response = await listDailyReflectionsHandler(
      mockHttpRequest({
        params: {},
        query: { startDate: '2026-01-01', endDate: '2026-01-01' }
      }),
      mockInvocationContext()
    );
    expect(response.status).toBe(400);
    expect(((response.jsonBody as { errors?: Array<{ id: string }> }).errors ?? [])[0]?.id).toBe(
      'participants.participantId.required'
    );
  });

  it('listDailyReflectionsHandler returns 403 when participant is not linked', async () => {
    const containers = createCosmosContainersStub();
    buildCosmosMock.mockResolvedValue({ containers });
    readParticipantLinkMock.mockResolvedValue(null);
    const response = await listDailyReflectionsHandler(
      mockHttpRequest({
        params: { participantId: 'participant_1' },
        query: { startDate: '2026-01-01', endDate: '2026-01-01' }
      }),
      mockInvocationContext()
    );
    expect(response.status).toBe(403);
    expect((response.jsonBody as { message?: string }).message).toBe('Participant not linked to user.');
  });

  it('upsertDailyReflectionHandler validates score payload', async () => {
    const containers = createCosmosContainersStub();
    buildCosmosMock.mockResolvedValue({ containers });
    const response = await upsertDailyReflectionHandler(
      mockHttpRequest({
        method: 'PUT',
        params: { participantId: 'participant_1', logLocalDate: '2026-01-01' },
        body: {
          logTzOffsetMinutes: 0,
          moodScore: 200,
          focusScore: 1,
          energyScore: 1,
          sleepScore: 1
        }
      }),
      mockInvocationContext()
    );
    expect(response.status).toBe(400);
  });

  it('upsertDailyReflectionHandler upserts and appends timeline event', async () => {
    const containers = createCosmosContainersStub();
    buildCosmosMock.mockResolvedValue({ containers });
    readDailyReflectionMock.mockResolvedValue(null);
    const response = await upsertDailyReflectionHandler(
      mockHttpRequest({
        method: 'PUT',
        params: { participantId: 'participant_1', logLocalDate: '2026-01-01' },
        body: {
          logTzOffsetMinutes: 0,
          moodScore: 10,
          focusScore: 20,
          energyScore: 30,
          sleepScore: 40,
          journalNote: ' note '
        }
      }),
      mockInvocationContext()
    );
    expect(response.status).toBe(200);
    expect((containers.dailyReflections.items.upsert as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect(appendTimelineEventMock).toHaveBeenCalledTimes(1);
  });

  it('upsertDailyReflectionHandler allows partial entry with only some scores', async () => {
    const containers = createCosmosContainersStub();
    buildCosmosMock.mockResolvedValue({ containers });
    readDailyReflectionMock.mockResolvedValue(null);
    const response = await upsertDailyReflectionHandler(
      mockHttpRequest({
        method: 'PUT',
        params: { participantId: 'participant_1', logLocalDate: '2026-01-01' },
        body: {
          logTzOffsetMinutes: 0,
          moodScore: 70
        }
      }),
      mockInvocationContext()
    );
    expect(response.status).toBe(200);
    const body = response.jsonBody as Record<string, unknown>;
    expect(body['moodScore']).toBe(70);
    expect(body['focusScore']).toBeNull();
    expect(body['energyScore']).toBeNull();
    expect(body['sleepScore']).toBeNull();
  });

  it('upsertDailyReflectionHandler rejects when all scores are null', async () => {
    const containers = createCosmosContainersStub();
    buildCosmosMock.mockResolvedValue({ containers });
    const response = await upsertDailyReflectionHandler(
      mockHttpRequest({
        method: 'PUT',
        params: { participantId: 'participant_1', logLocalDate: '2026-01-01' },
        body: {
          logTzOffsetMinutes: 0,
          moodScore: null,
          focusScore: null,
          energyScore: null,
          sleepScore: null
        }
      }),
      mockInvocationContext()
    );
    expect(response.status).toBe(400);
    const errors = ((response.jsonBody as { errors?: Array<{ id: string }> }).errors ?? []);
    expect(errors.some((e) => e.id === 'dailyReflections.scores.allNull')).toBe(true);
  });

  it('dailyReflectionsSummaryHandler excludes null scores from average', async () => {
    const containers = createCosmosContainersStub();
    (containers.dailyReflections.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({
        resources: [
          {
            id: 'daily_reflection_2026-01-01',
            participantId: 'participant_1',
            logLocalDate: '2026-01-01',
            logTzOffsetMinutes: 0,
            moodScore: 70,
            focusScore: null,
            energyScore: 50,
            sleepScore: null,
            createdAtUtc: '2026-01-01T00:00:00.000Z',
            updatedAtUtc: '2026-01-01T00:00:00.000Z',
            createdByUserId: 'user-1',
            updatedByUserId: 'user-1'
          }
        ]
      })
    });
    buildCosmosMock.mockResolvedValue({ containers });
    const response = await dailyReflectionsSummaryHandler(
      mockHttpRequest({
        params: { participantId: 'participant_1' },
        query: { endDate: '2026-01-01', days: '1' }
      }),
      mockInvocationContext()
    );
    expect(response.status).toBe(200);
    const body = response.jsonBody as Record<string, unknown>;
    const mood = body['mood'] as { averageScore: number | null; latestScore: number | null };
    const focus = body['focus'] as { averageScore: number | null; latestScore: number | null };
    expect(mood.averageScore).toBe(70);
    expect(mood.latestScore).toBe(70);
    expect(focus.averageScore).toBeNull();
    expect(focus.latestScore).toBeNull();
  });

  it('dailyReflectionsSummaryHandler validates invalid/future endDate', async () => {
    const containers = createCosmosContainersStub();
    buildCosmosMock.mockResolvedValue({ containers });
    const invalid = await dailyReflectionsSummaryHandler(
      mockHttpRequest({
        params: { participantId: 'participant_1' },
        query: { endDate: 'bad' }
      }),
      mockInvocationContext()
    );
    expect(invalid.status).toBe(400);

    const future = await dailyReflectionsSummaryHandler(
      mockHttpRequest({
        params: { participantId: 'participant_1' },
        query: { endDate: '2999-01-01' }
      }),
      mockInvocationContext()
    );
    expect(future.status).toBe(400);
  });

  it('dailyReflectionsSummaryHandler returns summary payload', async () => {
    const containers = createCosmosContainersStub();
    (containers.dailyReflections.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({
        resources: [
          {
            id: 'daily_reflection_2026-01-01',
            participantId: 'participant_1',
            logLocalDate: '2026-01-01',
            logTzOffsetMinutes: 0,
            moodScore: 10,
            focusScore: 20,
            energyScore: 30,
            sleepScore: 40,
            createdAtUtc: '2026-01-01T00:00:00.000Z',
            updatedAtUtc: '2026-01-01T00:00:00.000Z',
            createdByUserId: 'user-1',
            updatedByUserId: 'user-1'
          }
        ]
      })
    });
    buildCosmosMock.mockResolvedValue({ containers });
    const response = await dailyReflectionsSummaryHandler(
      mockHttpRequest({
        params: { participantId: 'participant_1' },
        query: { endDate: '2026-01-01', days: '1' }
      }),
      mockInvocationContext()
    );
    expect(response.status).toBe(200);
    expect((response.jsonBody as { days: number }).days).toBe(1);
  });
});
