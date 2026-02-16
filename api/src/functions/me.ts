import { app, HttpResponseInit } from '@azure/functions';
import { withAuthContext, AuthContext } from '../shared/handler-context';

/**
 * Returns the verified app JWT payload for the current user.
 */
const meInnerHandler = async (ctx: AuthContext): Promise<HttpResponseInit> => {
  return { status: 200, jsonBody: ctx.user };
};

const me = withAuthContext(meInnerHandler);

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
