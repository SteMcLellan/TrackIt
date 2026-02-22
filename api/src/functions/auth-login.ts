import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { buildConfig, readJwtHeader, signAppJwt, verifyGoogleIdToken } from '../shared/auth';
import { upsertUser } from '../shared/cosmos';
import { UserDocument } from '../models/user';
import { readUserBySub } from '../shared/data/users';
import { composeHttpHandler } from '../shared/http-middleware';
import { getRequestState } from '../shared/request-state';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';

/**
 * Exchanges a Google ID token for an app JWT and upserts the user profile.
 */
function requireContainers(context: InvocationContext) {
  const state = getRequestState(context);
  if (!state.containers) {
    throw new Error('Request context was not initialized.');
  }
  return state.containers;
}

const authLogin = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware
  ],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  let bodyToken = '';
  try {
    const body = (await req.json()) as unknown;
    if (body && typeof body === 'object' && 'idToken' in body && typeof (body as { idToken?: unknown }).idToken === 'string') {
      bodyToken = (body as { idToken: string }).idToken;
    }
  } catch {
    // Ignore invalid/missing JSON body.
  }

  const headerToken = req.headers.get('x-trackit-google-id-token') || '';
  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : authHeader;
  const idToken = bodyToken || headerToken || bearerToken;
  if (!idToken) {
    return { status: 401, jsonBody: { message: 'Missing Google ID token' } };
  }

  const config = buildConfig();

  const header = readJwtHeader(idToken);
  if (header?.alg?.startsWith('HS')) {
    return {
      status: 401,
      jsonBody: {
        message:
          'Expected a Google ID token (e.g. RS256). Received an HMAC token (HS*). This usually means the TrackIt app JWT (or a proxy-generated token) was sent instead of the Google credential.',
        alg: header.alg,
        kid: header.kid
      }
    };
  }

  let googleClaims: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
  try {
    googleClaims = await verifyGoogleIdToken(idToken, config);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid Google ID token';
    if (msg.includes('Unsupported "alg" value for a JSON Web Key Set')) {
      return {
        status: 401,
        jsonBody: {
          message:
            'Expected a Google ID token (e.g. RS256). Received a token with an unsupported algorithm for Google JWKS verification. Clear local storage and retry.',
          alg: header?.alg,
          kid: header?.kid
        }
      };
    }
    return { status: 401, jsonBody: { message: 'Invalid Google ID token' } };
  }

  const containers = requireContainers(context);
  const existing = await readUserBySub(containers.users, googleClaims.sub as string);
  const roles = existing?.roles && existing.roles.length > 0 ? existing.roles : ['parent'];
  const user: UserDocument = {
    sub: googleClaims.sub as string,
    email: googleClaims.email as string,
    name: (googleClaims.name as string) || '',
    picture: googleClaims.picture as string,
    roles,
    createdAt: '',
    lastLoginAt: ''
  };

  const stored = await upsertUser(containers, user);
  const persistedRoles = stored.roles && stored.roles.length > 0 ? stored.roles : roles;
  const token = signAppJwt({
    sub: stored.sub,
    email: stored.email,
    name: stored.name,
    picture: stored.picture,
    role: persistedRoles[0],
    roles: persistedRoles
  }, config);

  return {
    status: 200,
    jsonBody: {
      sub: stored.sub,
      email: stored.email,
      name: stored.name,
      picture: stored.picture,
      role: persistedRoles[0],
      roles: persistedRoles,
      token
    }
  };
  }
});

/**
 * Anonymous endpoint for initial sign-in with a Google ID token.
 */
app.http('auth-login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: authLogin
});

export { authLogin };
