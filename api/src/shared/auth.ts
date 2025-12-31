import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import jwt from 'jsonwebtoken';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

/**
 * Remote JWKS for Google ID token validation.
 */
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/**
 * Claims stored in the app-issued JWT.
 */
export interface AppUserClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  role?: string;
}

export interface AppJwtPayload extends AppUserClaims {
  iat: number;
  exp: number;
}

/**
 * Auth configuration loaded from environment variables.
 */
export interface AuthConfig {
  googleClientId: string;
  jwtSecret: string;
  jwtExpirySeconds: number;
  audience: string;
}

/**
 * Verifies a Google ID token against the Google JWKS and required claims.
 */
export async function verifyGoogleIdToken(idToken: string, config: AuthConfig): Promise<JWTPayload> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
    audience: config.googleClientId
  });
  return payload;
}

/**
 * Signs a TrackIt app JWT using the configured HMAC secret.
 */
export function signAppJwt(claims: AppUserClaims, config: AuthConfig): string {
  return jwt.sign(
    {
      sub: claims.sub,
      email: claims.email,
      name: claims.name,
      picture: claims.picture,
      role: claims.role || 'parent'
    },
    config.jwtSecret,
    { algorithm: 'HS256', expiresIn: config.jwtExpirySeconds, audience: config.audience }
  );
}

/**
 * Builds authentication config from environment variables.
 */
export function buildConfig(): AuthConfig {
  return {
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    jwtSecret: process.env.JWT_SECRET || 'local-secret',
    jwtExpirySeconds: Number(process.env.JWT_EXPIRY_SECONDS || 3600),
    audience: process.env.JWT_AUDIENCE || 'trackit-app'
  };
}

/**
 * Wraps an Azure Function handler to return structured errors.
 */
export function withErrorHandling(
  handler: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>
) {
  return async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      return await handler(req, context);
    } catch (err: unknown) {
      context.error('Error', err);
      const status =
        typeof err === 'object' && err && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
          ? (err as { status: number }).status
          : 500;
      return {
        status,
        jsonBody: { message: err instanceof Error ? err.message : 'Internal error' }
      };
    }
  };
}
