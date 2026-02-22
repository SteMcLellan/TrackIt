import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import type { AuthContext } from '../shared/handler-context';
import { bindBusinessHandler, resolveAuthContext } from '../shared/endpoint-template';
import { composeHttpHandler } from '../shared/http-middleware';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';

/**
 * Returns the verified app JWT payload for the current user.
 */
const meBusinessHandler = async (ctx: AuthContext, _req: HttpRequest): Promise<HttpResponseInit> => {
  return { status: 200, jsonBody: ctx.user };
};

const me = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware
  ],
  handler: bindBusinessHandler(resolveAuthContext, meBusinessHandler)
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

export { me, meBusinessHandler };
