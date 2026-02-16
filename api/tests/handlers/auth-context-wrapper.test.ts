import { describe, expect, it, vi, beforeEach } from 'vitest';
import { withAuthContext } from '../../src/shared/handler-context';
import { mockHttpRequest } from '../helpers/http';
import { mockInvocationContext } from '../helpers/context';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';

const authorizeMock = vi.fn();
const buildCosmosMock = vi.fn();

vi.mock('../../src/shared/authorize', () => ({
  authorize: (...args: unknown[]) => authorizeMock(...args)
}));

vi.mock('../../src/shared/cosmos', () => ({
  buildCosmos: (...args: unknown[]) => buildCosmosMock(...args)
}));

describe('withAuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildCosmosMock.mockResolvedValue({ containers: createCosmosContainersStub() });
    authorizeMock.mockReturnValue({ sub: 'user-1', iat: 1, exp: 2 });
  });

  it('returns 401 when authorize throws', async () => {
    const error = new Error('Missing app token') as Error & { status: number };
    error.status = 401;
    authorizeMock.mockImplementation(() => {
      throw error;
    });

    const handler = withAuthContext(async () => ({ status: 200, jsonBody: { ok: true } }));
    const response = await handler(mockHttpRequest(), mockInvocationContext());
    expect(response.status).toBe(401);
  });

  it('passes user and containers into inner handler', async () => {
    const inner = vi.fn().mockResolvedValue({ status: 200, jsonBody: { ok: true } });
    const handler = withAuthContext(inner);
    const response = await handler(mockHttpRequest(), mockInvocationContext());

    expect(response.status).toBe(200);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(inner.mock.calls[0][0].user.sub).toBe('user-1');
    expect(inner.mock.calls[0][0].containers).toBeDefined();
  });
});
