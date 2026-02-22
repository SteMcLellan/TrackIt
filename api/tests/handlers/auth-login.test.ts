import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockHttpRequest } from '../helpers/http';

const buildConfigMock = vi.fn();
const readJwtHeaderMock = vi.fn();
const verifyGoogleIdTokenMock = vi.fn();
const signAppJwtMock = vi.fn();
const readUserBySubMock = vi.fn();
const upsertUserMock = vi.fn();

vi.mock('../../src/shared/auth', async () => {
  const actual = await vi.importActual('../../src/shared/auth');
  return {
    ...(actual as object),
    buildConfig: (...args: unknown[]) => buildConfigMock(...args),
    readJwtHeader: (...args: unknown[]) => readJwtHeaderMock(...args),
    verifyGoogleIdToken: (...args: unknown[]) => verifyGoogleIdTokenMock(...args),
    signAppJwt: (...args: unknown[]) => signAppJwtMock(...args)
  };
});

vi.mock('../../src/shared/cosmos', () => ({
  upsertUser: (...args: unknown[]) => upsertUserMock(...args)
}));

vi.mock('../../src/shared/data/users', () => ({
  readUserBySub: (...args: unknown[]) => readUserBySubMock(...args)
}));

import { authLoginBusinessHandler } from '../../src/functions/auth-login';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';

describe('auth-login handler', () => {
  const requestContext = {
    containers: createCosmosContainersStub()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    buildConfigMock.mockReturnValue({ jwtSecret: 'x', audience: 'trackit-app', jwtExpirySeconds: 3600, googleClientId: 'g' });
    readJwtHeaderMock.mockReturnValue({ alg: 'RS256', kid: 'kid' });
    verifyGoogleIdTokenMock.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      name: 'User One',
      picture: 'pic'
    });
    signAppJwtMock.mockReturnValue('app.jwt.token');
    readUserBySubMock.mockResolvedValue({ roles: ['parent'] });
    upsertUserMock.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      name: 'User One',
      picture: 'pic',
      roles: ['parent']
    });
  });

  it('returns 401 when token is missing', async () => {
    const response = await authLoginBusinessHandler(requestContext, mockHttpRequest({ method: 'POST' }));
    expect(response.status).toBe(401);
  });

  it('returns 401 for HS algorithm header', async () => {
    readJwtHeaderMock.mockReturnValue({ alg: 'HS256', kid: 'kid' });
    const response = await authLoginBusinessHandler(requestContext, mockHttpRequest({ method: 'POST', body: { idToken: 'token' } }));
    expect(response.status).toBe(401);
    expect((response.jsonBody as { alg?: string }).alg).toBe('HS256');
  });

  it('returns specific unsupported alg error', async () => {
    verifyGoogleIdTokenMock.mockRejectedValue(new Error('Unsupported "alg" value for a JSON Web Key Set'));
    const response = await authLoginBusinessHandler(requestContext, mockHttpRequest({ method: 'POST', body: { idToken: 'token' } }));
    expect(response.status).toBe(401);
    expect((response.jsonBody as { message?: string }).message).toContain('Expected a Google ID token');
  });

  it('returns token and persisted user fields on success', async () => {
    const response = await authLoginBusinessHandler(requestContext, mockHttpRequest({ method: 'POST', body: { idToken: 'token' } }));
    expect(response.status).toBe(200);
    const body = response.jsonBody as { token: string; roles: string[] };
    expect(body.token).toBe('app.jwt.token');
    expect(body.roles).toEqual(['parent']);
  });
});
