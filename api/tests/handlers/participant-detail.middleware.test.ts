import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { readParticipantHandler } from '../../src/functions/participant-detail';
import { mockHttpRequest } from '../helpers/http';
import { mockInvocationContext } from '../helpers/context';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';

const authorizeMock = vi.fn();
const buildCosmosMock = vi.fn();
const resolveClerkIdentityBySubMock = vi.fn();
const upsertUserMock = vi.fn();
const readParticipantMock = vi.fn();
const readParticipantLinkMock = vi.fn();

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

vi.mock('../../src/shared/data/participants', async () => {
  const actual = await vi.importActual('../../src/shared/data/participants');
  return {
    ...actual,
    readParticipant: (...args: unknown[]) => readParticipantMock(...args),
    readParticipantLink: (...args: unknown[]) => readParticipantLinkMock(...args)
  };
});

describe('participant-detail middleware pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildCosmosMock.mockResolvedValue({ containers: createCosmosContainersStub() });
    authorizeMock.mockReturnValue({ sub: 'user-1', iat: 1, exp: 2 });
    resolveClerkIdentityBySubMock.mockResolvedValue({
      sub: 'user-1',
      email: 'user-1@example.com',
      name: 'User One'
    });
    readParticipantLinkMock.mockResolvedValue({
      id: 'user-1:participant-1',
      userId: 'user-1',
      participantId: 'participant-1',
      role: 'manager',
      createdAtUtc: '2026-02-01T00:00:00.000Z'
    });
    readParticipantMock.mockResolvedValue({
      id: 'participant-1',
      displayName: 'Kid',
      birthDate: '2020-01-15',
      createdAtUtc: '2026-01-01T00:00:00.000Z',
      createdByUserId: 'user-1'
    });
  });

  it('requires participantId route param (legacy id param is rejected)', async () => {
    const response = await readParticipantHandler(
      mockHttpRequest({ params: { id: 'participant-1' } }) as HttpRequest,
      mockInvocationContext() as InvocationContext
    );

    expect(response.status).toBe(400);
    expect((response.jsonBody as { errors?: Array<{ id: string }> }).errors?.[0]?.id).toBe(
      'participants.participantId.required'
    );
  });

  it('uses participantId param to read participant', async () => {
    const response = await readParticipantHandler(
      mockHttpRequest({ params: { participantId: 'participant-1' } }) as HttpRequest,
      mockInvocationContext() as InvocationContext
    );

    expect(response.status).toBe(200);
    expect(readParticipantMock).toHaveBeenCalledWith(expect.anything(), 'participant-1');
  });
});
