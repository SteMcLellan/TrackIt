import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { buildConfig, readJwtHeader, resolveClerkIdentity, signAppJwt } from '../shared/auth';
import { upsertUser } from '../shared/cosmos';
import { UserDocument } from '../models/user';
import { readUserBySub } from '../shared/data/users';
import {
  bindBusinessHandler,
  RequestResourcesContext,
  resolveRequestResourcesContext
} from '../shared/endpoint-template';
import { composeHttpHandler } from '../shared/http-middleware';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';

const authLoginBusinessHandler = async (
  requestContext: RequestResourcesContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
  const containers = requestContext.containers;

  let bodyToken = '';
  try {
    const body = (await req.json()) as unknown;
    if (
      body
      && typeof body === 'object'
      && 'sessionToken' in body
      && typeof (body as { sessionToken?: unknown }).sessionToken === 'string'
    ) {
      bodyToken = (body as { sessionToken: string }).sessionToken;
    }
  } catch {
    // Ignore invalid or missing JSON bodies.
  }

  const headerToken = req.headers.get('x-trackit-clerk-session-token') || '';
  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : authHeader;
  const sessionToken = bodyToken || headerToken || bearerToken;
  if (!sessionToken) {
    return { status: 401, jsonBody: { message: 'Missing Clerk session token' } };
  }

  const config = buildConfig();
  if (!config.clerkSecretKey && !config.clerkJwtKey) {
    return {
      status: 500,
      jsonBody: { message: 'Clerk session verification is not configured.' }
    };
  }

  const header = readJwtHeader(sessionToken);
  if (header?.alg?.startsWith('HS')) {
    return {
      status: 401,
      jsonBody: {
        message:
          'Expected a Clerk session token. Received an HMAC token (HS*), which usually means the TrackIt app JWT was sent instead.',
        alg: header.alg,
        kid: header.kid
      }
    };
  }

  let identity: Awaited<ReturnType<typeof resolveClerkIdentity>>;
  try {
    identity = await resolveClerkIdentity(sessionToken, config);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid Clerk session token';
    const status = message.includes('required to resolve Clerk user profiles') ? 500 : 401;
    return { status, jsonBody: { message } };
  }

  const existing = await readUserBySub(containers.users, identity.sub);
  const roles = existing?.roles && existing.roles.length > 0 ? existing.roles : ['parent'];
  const user: UserDocument = {
    sub: identity.sub,
    email: identity.email,
    name: identity.name,
    picture: identity.picture,
    roles,
    createdAt: '',
    lastLoginAt: ''
  };

  const stored = await upsertUser(containers, user);
  const persistedRoles = stored.roles && stored.roles.length > 0 ? stored.roles : roles;
  const token = signAppJwt(
    {
      sub: stored.sub,
      email: stored.email,
      name: stored.name,
      picture: stored.picture,
      role: persistedRoles[0],
      roles: persistedRoles
    },
    config
  );

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
};

const authLogin = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware
  ],
  handler: bindBusinessHandler(resolveRequestResourcesContext, authLoginBusinessHandler)
});

app.http('auth-login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: authLogin
});

export { authLogin, authLoginBusinessHandler };
