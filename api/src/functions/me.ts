import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { withErrorHandling } from '../shared/auth';

/**
 * Returns the verified app JWT payload for the current user.
 */
const me = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  const payload = authorize(context, req);
  return { status: 200, jsonBody: payload };
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

export { me };
