import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { buildConfig, signAppJwt, verifyGoogleIdToken, withErrorHandling } from '../shared/auth';

/**
 * Issues a fresh app JWT using a valid Google ID token.
 */
const authRefresh = withErrorHandling(async (req: HttpRequest): Promise<HttpResponseInit> => {
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
  const token = signAppJwt(
    {
      sub: claims.sub as string,
      email: claims.email as string,
      name: claims.name as string,
      picture: claims.picture as string,
      role: 'parent'
    },
    config
  );

  return { status: 200, jsonBody: { token } };
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
