import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockHttpRequest } from '../helpers/http';

const buildConfigMock = vi.fn();
const readJwtHeaderMock = vi.fn();
const resolveClerkIdentityMock = vi.fn();
const signAppJwtMock = vi.fn();
const readUserBySubMock = vi.fn();
const upsertUserMock = vi.fn();

vi.mock('../../src/shared/auth', async () => {
  const actual = await vi.importActual('../../src/shared/auth');
  return {
    ...(actual as object),
    buildConfig: (...args: unknown[]) => buildConfigMock(...args),
    readJwtHeader: (...args: unknown[]) => readJwtHeaderMock(...args),
    resolveClerkIdentity: (...args: unknown[]) => resolveClerkIdentityMock(...args),
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
    buildConfigMock.mockReturnValue({
      audience: 'trackit-app',
      clerkAuthorizedParties: ['http://localhost:4200'],
      clerkJwtKey: '',
      clerkSecretKey: 'sk_test_123',
      jwtExpirySeconds: 3600,
      jwtSecret: 'x'
    });
    readJwtHeaderMock.mockReturnValue({ alg: 'RS256', kid: 'kid' });
    resolveClerkIdentityMock.mockResolvedValue({
      sub: 'user_1',
      email: 'user@example.com',
      name: 'User One',
      picture: 'pic'
    });
    signAppJwtMock.mockReturnValue('app.jwt.token');
    readUserBySubMock.mockResolvedValue({ roles: ['parent'] });
    upsertUserMock.mockResolvedValue({
      sub: 'user_1',
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

  it('returns 500 when Clerk verification is not configured', async () => {
    buildConfigMock.mockReturnValue({
      audience: 'trackit-app',
      clerkAuthorizedParties: [],
      clerkJwtKey: '',
      clerkSecretKey: '',
      jwtExpirySeconds: 3600,
      jwtSecret: 'x'
    });

    const response = await authLoginBusinessHandler(
      requestContext,
      mockHttpRequest({ method: 'POST', body: { sessionToken: 'token' } })
    );

    expect(response.status).toBe(500);
  });

  it('returns 401 for HS algorithm header', async () => {
    readJwtHeaderMock.mockReturnValue({ alg: 'HS256', kid: 'kid' });

    const response = await authLoginBusinessHandler(
      requestContext,
      mockHttpRequest({ method: 'POST', body: { sessionToken: 'token' } })
    );

    expect(response.status).toBe(401);
    expect((response.jsonBody as { alg?: string }).alg).toBe('HS256');
  });

  it('returns token and persisted user fields on success', async () => {
    const response = await authLoginBusinessHandler(
      requestContext,
      mockHttpRequest({ method: 'POST', body: { sessionToken: 'token' } })
    );

    expect(response.status).toBe(200);
    const body = response.jsonBody as { token: string; roles: string[] };
    expect(body.token).toBe('app.jwt.token');
    expect(body.roles).toEqual(['parent']);
  });
});
