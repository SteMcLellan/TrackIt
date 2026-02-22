import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import type { AuthContext } from '../shared/handler-context';
import { composeHttpHandler } from '../shared/http-middleware';
import { getRequestState } from '../shared/request-state';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';

/**
 * Returns the verified app JWT payload for the current user.
 */
const meInnerHandler = async (ctx: AuthContext): Promise<HttpResponseInit> => {
  return { status: 200, jsonBody: ctx.user };
};

function requireAuthContext(context: InvocationContext): AuthContext {
  const state = getRequestState(context);
  if (!state.containers || !state.user) {
    throw new Error('Auth context was not initialized.');
  }

  return {
    user: state.user,
    containers: state.containers
  };
}

const me = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware
  ],
  handler: async (_req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const authContext = requireAuthContext(context);
    return meInnerHandler(authContext);
  }
});

/**
 * Authenticated endpoint for fetching the current user's claims.
 */
app.http('me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  handler: me
});

export { me, meInnerHandler };
