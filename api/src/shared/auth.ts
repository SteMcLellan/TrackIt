import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import jwt from 'jsonwebtoken';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

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

export interface AuthConfig {
  googleClientId: string;
  jwtSecret: string;
  jwtExpirySeconds: number;
  audience: string;
}

export async function verifyGoogleIdToken(idToken: string, config: AuthConfig): Promise<JWTPayload> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
    audience: config.googleClientId
  });
  return payload;
}

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

export function buildConfig(): AuthConfig {
  return {
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    jwtSecret: process.env.JWT_SECRET || 'local-secret',
    jwtExpirySeconds: Number(process.env.JWT_EXPIRY_SECONDS || 3600),
    audience: process.env.JWT_AUDIENCE || 'trackit-app'
  };
}

export function withErrorHandling(
  handler: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>
) {
  return async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      return await handler(req, context);
    } catch (err: any) {
      context.error('Error', err);
      const status = err.status || 500;
      return {
        status,
        jsonBody: { message: err.message || 'Internal error' }
      };
    }
  };
}
