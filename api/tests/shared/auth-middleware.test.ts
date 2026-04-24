import { describe, expect, it, vi, beforeEach } from 'vitest';
import { authMiddleware } from '../../src/shared/middleware/auth';
import { getRequestState } from '../../src/shared/request-state';
import { mockHttpRequest } from '../helpers/http';
import { mockInvocationContext } from '../helpers/context';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';

const authorizeMock = vi.fn();
const buildConfigMock = vi.fn();
const buildCosmosMock = vi.fn();
const resolveClerkIdentityBySubMock = vi.fn();
const upsertUserMock = vi.fn();

vi.mock('../../src/shared/authorize', () => ({
  authorize: (...args: unknown[]) => authorizeMock(...args)
}));

vi.mock('../../src/shared/auth', () => ({
  buildConfig: (...args: unknown[]) => buildConfigMock(...args),
  resolveClerkIdentityBySub: (...args: unknown[]) => resolveClerkIdentityBySubMock(...args)
}));

vi.mock('../../src/shared/cosmos', () => ({
  buildCosmos: (...args: unknown[]) => buildCosmosMock(...args),
  upsertUser: (...args: unknown[]) => upsertUserMock(...args)
}));

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildConfigMock.mockReturnValue({ clerkAuthorizedParties: [], clerkJwtKey: '', clerkSecretKey: 'sk_test' });
    buildCosmosMock.mockResolvedValue({ containers: createCosmosContainersStub() });
    authorizeMock.mockResolvedValue({ sub: 'user_1', metadata: { roles: ['admin'] } });
    resolveClerkIdentityBySubMock.mockResolvedValue({
      sub: 'user_1',
      email: 'user@example.com',
      name: 'User One',
      picture: 'https://example.com/user.png'
    });
  });

  it('provisions the Clerk-backed user projection before continuing', async () => {
    const request = mockHttpRequest({ headers: { 'x-trackit-app-token': 'token' } });
    const context = mockInvocationContext();
    const next = vi.fn().mockResolvedValue({ status: 204 });

    const response = await authMiddleware(request, context, next);

    expect(response.status).toBe(204);
    expect(resolveClerkIdentityBySubMock).toHaveBeenCalledWith('user_1', {
      clerkAuthorizedParties: [],
      clerkJwtKey: '',
      clerkSecretKey: 'sk_test'
    });
    expect(upsertUserMock).toHaveBeenCalledWith(expect.any(Object), {
      sub: 'user_1',
      email: 'user@example.com',
      name: 'User One',
      picture: 'https://example.com/user.png'
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(getRequestState(context).user).toEqual({ sub: 'user_1', metadata: { roles: ['admin'] } });
  });
});
