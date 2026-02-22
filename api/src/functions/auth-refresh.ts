import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { buildConfig, signAppJwt, verifyGoogleIdToken } from '../shared/auth';
import { readUserBySub } from '../shared/data/users';
import { composeHttpHandler } from '../shared/http-middleware';
import { getRequestState } from '../shared/request-state';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';

/**
 * Issues a fresh app JWT using a valid Google ID token.
 */
function requireContainers(context: InvocationContext) {
  const state = getRequestState(context);
  if (!state.containers) {
    throw new Error('Request context was not initialized.');
  }
  return state.containers;
}

const authRefresh = composeHttpHandler({
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
  const claims = await verifyGoogleIdToken(idToken, config);
  const containers = requireContainers(context);
  const user = await readUserBySub(containers.users, claims.sub as string);
  const roles = user?.roles && user.roles.length > 0 ? user.roles : ['parent'];
  const token = signAppJwt(
    {
      sub: claims.sub as string,
      email: claims.email as string,
      name: claims.name as string,
      picture: claims.picture as string,
      role: roles[0],
      roles
    },
    config
  );

  return { status: 200, jsonBody: { token, role: roles[0], roles } };
  }
});

/**
 * Anonymous endpoint for refreshing app access tokens.
 */
app.http('auth-refresh', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/refresh',
  handler: authRefresh
});

export { authRefresh };
