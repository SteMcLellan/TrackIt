import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { buildConfig, readJwtHeader, signAppJwt, verifyGoogleIdToken, withErrorHandling } from '../shared/auth';
import { buildCosmos, upsertUser } from '../shared/cosmos';
import { UserDocument } from '../models/user';

/**
 * Exchanges a Google ID token for an app JWT and upserts the user profile.
 */
const authLogin = withErrorHandling(async (req: HttpRequest): Promise<HttpResponseInit> => {
  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : authHeader;
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
          'Expected a Google ID token (e.g. RS256). Received an HMAC token (likely the TrackIt app JWT). Clear local storage and retry.',
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

  const { containers } = await buildCosmos();
  const user: UserDocument = {
    sub: googleClaims.sub as string,
    email: googleClaims.email as string,
    name: (googleClaims.name as string) || '',
    picture: googleClaims.picture as string,
    roles: ['parent'],
    createdAt: '',
    lastLoginAt: ''
  };

  const stored = await upsertUser(containers, user);
  const token = signAppJwt({
    sub: stored.sub,
    email: stored.email,
    name: stored.name,
    picture: stored.picture,
    role: stored.roles?.[0]
  }, config);

  return {
    status: 200,
    jsonBody: {
      sub: stored.sub,
      email: stored.email,
      name: stored.name,
      picture: stored.picture,
      role: stored.roles?.[0] || 'parent',
      token
    }
  };
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
