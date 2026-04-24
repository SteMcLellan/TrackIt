import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { participantMiddleware } from '../../src/shared/middleware/participant';
import { getRequestState, setRequestState } from '../../src/shared/request-state';
import { mockHttpRequest } from '../helpers/http';
import { mockInvocationContext } from '../helpers/context';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';

const authorizeMock = vi.fn();
const buildCosmosMock = vi.fn();
const resolveClerkIdentityBySubMock = vi.fn();
const upsertUserMock = vi.fn();
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

vi.mock('../../src/shared/data/participants', () => ({
  readParticipantLink: (...args: unknown[]) => readParticipantLinkMock(...args)
}));

describe('participantMiddleware', () => {
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
  });

  it('returns 400 when participantId route param is missing', async () => {
    const next = vi.fn();
    const response = await participantMiddleware(
      mockHttpRequest({ params: {} }) as HttpRequest,
      mockInvocationContext() as InvocationContext,
      next
    );

    expect(response.status).toBe(400);
    expect((response.jsonBody as { errors?: Array<{ id: string }> }).errors?.[0]?.id).toBe(
      'participants.participantId.required'
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when participant link is missing', async () => {
    readParticipantLinkMock.mockResolvedValue(null);
    const next = vi.fn();
    const response = await participantMiddleware(
      mockHttpRequest({ params: { participantId: 'participant-1' } }) as HttpRequest,
      mockInvocationContext() as InvocationContext,
      next
    );

    expect(response.status).toBe(403);
    expect((response.jsonBody as { message?: string }).message).toBe('Participant not linked to user.');
    expect(next).not.toHaveBeenCalled();
  });

  it('stores participant state and calls next on success', async () => {
    const context = mockInvocationContext() as InvocationContext;
    const next = vi.fn().mockResolvedValue({ status: 200 });
    const response = await participantMiddleware(
      mockHttpRequest({ params: { participantId: 'participant-1' } }) as HttpRequest,
      context,
      next
    );

    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
    expect(getRequestState(context).participant?.id).toBe('participant-1');
    expect(getRequestState(context).user?.sub).toBe('user-1');
  });

  it('reuses existing request-state user/containers', async () => {
    const context = mockInvocationContext() as InvocationContext;
    const containers = createCosmosContainersStub();
    setRequestState(context, {
      user: { sub: 'preset-user', iat: 1, exp: 2 },
      containers
    });

    const next = vi.fn().mockResolvedValue({ status: 200 });
    const response = await participantMiddleware(
      mockHttpRequest({ params: { participantId: 'participant-1' } }) as HttpRequest,
      context,
      next
    );

    expect(response.status).toBe(200);
    expect(buildCosmosMock).not.toHaveBeenCalled();
    expect(authorizeMock).not.toHaveBeenCalled();
    expect(readParticipantLinkMock).toHaveBeenCalledWith(
      containers.userParticipantLinks,
      'preset-user',
      'participant-1'
    );
  });
});
