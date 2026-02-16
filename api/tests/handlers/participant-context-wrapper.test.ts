import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { withParticipantContext } from '../../src/shared/handler-context';
import { mockHttpRequest } from '../helpers/http';
import { mockInvocationContext } from '../helpers/context';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';

const authorizeMock = vi.fn();
const buildCosmosMock = vi.fn();
const readParticipantLinkMock = vi.fn();

vi.mock('../../src/shared/authorize', () => ({
  authorize: (...args: unknown[]) => authorizeMock(...args)
}));

vi.mock('../../src/shared/cosmos', () => ({
  buildCosmos: (...args: unknown[]) => buildCosmosMock(...args)
}));

vi.mock('../../src/shared/data/participants', () => ({
  readParticipantLink: (...args: unknown[]) => readParticipantLinkMock(...args)
}));

describe('withParticipantContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildCosmosMock.mockResolvedValue({ containers: createCosmosContainersStub() });
    authorizeMock.mockReturnValue({ sub: 'user-1', iat: 1, exp: 2 });
    readParticipantLinkMock.mockResolvedValue({
      id: 'user-1:participant-1',
      userId: 'user-1',
      participantId: 'participant-1',
      role: 'manager',
      createdAt: '2026-02-01T00:00:00.000Z'
    });
  });

  function makeHandler() {
    return withParticipantContext(
      {
        missingParticipantErrorId: 'medications.participantId.required'
      },
      async () => ({ status: 200, jsonBody: { ok: true } })
    );
  }

  it('returns 401 when authorize throws', async () => {
    const error = new Error('Missing app token') as Error & { status: number };
    error.status = 401;
    authorizeMock.mockImplementation(() => {
      throw error;
    });

    const handler = makeHandler();
    const response = await handler(
      mockHttpRequest({ params: { participantId: 'participant-1' } }) as HttpRequest,
      mockInvocationContext() as InvocationContext
    );

    expect(response.status).toBe(401);
  });

  it('returns 400 when participant id route param is missing', async () => {
    const handler = makeHandler();
    const response = await handler(
      mockHttpRequest({ params: {} }) as HttpRequest,
      mockInvocationContext() as InvocationContext
    );

    expect(response.status).toBe(400);
    expect((response.jsonBody as { errors?: Array<{ id: string }> }).errors?.[0]?.id).toBe(
      'medications.participantId.required'
    );
  });

  it('returns 403 when participant link is missing', async () => {
    readParticipantLinkMock.mockResolvedValue(null);
    const handler = makeHandler();

    const response = await handler(
      mockHttpRequest({ params: { participantId: 'participant-1' } }) as HttpRequest,
      mockInvocationContext() as InvocationContext
    );

    expect(response.status).toBe(403);
    expect((response.jsonBody as { message?: string }).message).toBe('Participant not linked to user.');
  });

  it('passes resolved context to inner handler on success', async () => {
    const inner = vi.fn().mockResolvedValue({ status: 200, jsonBody: { ok: true } });
    const handler = withParticipantContext(
      {
        missingParticipantErrorId: 'medications.participantId.required'
      },
      inner
    );

    const response = await handler(
      mockHttpRequest({ params: { participantId: 'participant-1' } }) as HttpRequest,
      mockInvocationContext() as InvocationContext
    );

    expect(response.status).toBe(200);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(inner.mock.calls[0][0].participantId).toBe('participant-1');
    expect(inner.mock.calls[0][0].user.sub).toBe('user-1');
  });
});
