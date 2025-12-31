import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import jwt from 'jsonwebtoken';
import { AppJwtPayload, buildConfig, withErrorHandling } from '../shared/auth';

/**
 * Returns the verified app JWT payload for the current user.
 */
const me = withErrorHandling(async (req: HttpRequest): Promise<HttpResponseInit> => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) {
    return { status: 401, jsonBody: { message: 'Missing app token' } };
  }

  const config = buildConfig();
  const payload = jwt.verify(token, config.jwtSecret, { audience: config.audience }) as AppJwtPayload;
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
