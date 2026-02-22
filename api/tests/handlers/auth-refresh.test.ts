import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockHttpRequest } from '../helpers/http';

const buildConfigMock = vi.fn();
const verifyGoogleIdTokenMock = vi.fn();
const signAppJwtMock = vi.fn();
const readUserBySubMock = vi.fn();

vi.mock('../../src/shared/auth', async () => {
  const actual = await vi.importActual('../../src/shared/auth');
  return {
    ...(actual as object),
    buildConfig: (...args: unknown[]) => buildConfigMock(...args),
    verifyGoogleIdToken: (...args: unknown[]) => verifyGoogleIdTokenMock(...args),
    signAppJwt: (...args: unknown[]) => signAppJwtMock(...args)
  };
});

vi.mock('../../src/shared/cosmos', () => ({
  buildCosmos: vi.fn()
}));

vi.mock('../../src/shared/data/users', () => ({
  readUserBySub: (...args: unknown[]) => readUserBySubMock(...args)
}));

import { authRefreshBusinessHandler } from '../../src/functions/auth-refresh';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';

describe('auth-refresh handler', () => {
  const requestContext = {
    containers: createCosmosContainersStub()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    buildConfigMock.mockReturnValue({ jwtSecret: 'x', audience: 'trackit-app', jwtExpirySeconds: 3600, googleClientId: 'g' });
    verifyGoogleIdTokenMock.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      name: 'User One',
      picture: 'pic'
    });
    signAppJwtMock.mockReturnValue('refreshed.token');
    readUserBySubMock.mockResolvedValue({ roles: ['admin'] });
  });

  it('returns 401 when id token is missing', async () => {
    const response = await authRefreshBusinessHandler(requestContext, mockHttpRequest({ method: 'POST' }));
    expect(response.status).toBe(401);
  });

  it('returns token and roles on success', async () => {
    const response = await authRefreshBusinessHandler(
      requestContext,
      mockHttpRequest({ method: 'POST', body: { idToken: 'google-token' } })
    );
    expect(response.status).toBe(200);
    const body = response.jsonBody as { token: string; roles: string[]; role: string };
    expect(body.token).toBe('refreshed.token');
    expect(body.role).toBe('admin');
    expect(body.roles).toEqual(['admin']);
  });
});
