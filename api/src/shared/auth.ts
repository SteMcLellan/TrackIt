import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import jwt from 'jsonwebtoken';

/**
 * Remote JWKS for Google ID token validation.
 */
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

/**
 * Best-effort decode of the JWT header without validating the token.
 */
export function readJwtHeader(token: string): JwtHeader | null {
  try {
    const [rawHeader] = token.split('.');
    if (!rawHeader) {
      return null;
    }

    const base64 = rawHeader.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLength);

    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as Record<string, unknown>;

    return {
      alg: typeof parsed.alg === 'string' ? parsed.alg : undefined,
      kid: typeof parsed.kid === 'string' ? parsed.kid : undefined,
      typ: typeof parsed.typ === 'string' ? parsed.typ : undefined
    };
  } catch {
    return null;
  }
}

/**
 * Claims stored in the app-issued JWT.
 */
export interface AppUserClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  role?: string;
  roles?: string[];
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
  const roles = Array.isArray(claims.roles) && claims.roles.length > 0
    ? claims.roles
    : [claims.role || 'parent'];
  const role = claims.role || roles[0] || 'parent';

  return jwt.sign(
    {
      sub: claims.sub,
      email: claims.email,
      name: claims.name,
      picture: claims.picture,
      role,
      roles
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

