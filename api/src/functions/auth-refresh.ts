import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { buildConfig, resolveClerkIdentity, signAppJwt } from '../shared/auth';
import { readUserBySub } from '../shared/data/users';
import {
  bindBusinessHandler,
  RequestResourcesContext,
  resolveRequestResourcesContext
} from '../shared/endpoint-template';
import { composeHttpHandler } from '../shared/http-middleware';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';

const authRefreshBusinessHandler = async (
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

  let identity: Awaited<ReturnType<typeof resolveClerkIdentity>>;
  try {
    identity = await resolveClerkIdentity(sessionToken, config);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid Clerk session token';
    const status = message.includes('required to resolve Clerk user profiles') ? 500 : 401;
    return { status, jsonBody: { message } };
  }
  const user = await readUserBySub(containers.users, identity.sub);
  const roles = user?.roles && user.roles.length > 0 ? user.roles : ['parent'];
  const token = signAppJwt(
    {
      sub: identity.sub,
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
      role: roles[0],
      roles
    },
    config
  );

  return {
    status: 200,
    jsonBody: {
      token,
      role: roles[0],
      roles
    }
  };
};

const authRefresh = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware
  ],
  handler: bindBusinessHandler(resolveRequestResourcesContext, authRefreshBusinessHandler)
});

app.http('auth-refresh', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/refresh',
  handler: authRefresh
});

export { authRefresh, authRefreshBusinessHandler };
