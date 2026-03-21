import { createClerkClient, verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';

export interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

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

export interface AuthConfig {
  clerkAuthorizedParties: string[];
  clerkJwtKey: string;
  clerkSecretKey: string;
  jwtSecret: string;
  jwtExpirySeconds: number;
  audience: string;
}

export interface ResolvedClerkIdentity {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

let cachedClerkClient: ReturnType<typeof createClerkClient> | null = null;
let cachedClerkSecretKey = '';

export async function verifyClerkSessionToken(sessionToken: string, config: AuthConfig): Promise<{ sub?: string }> {
  const options: {
    authorizedParties?: string[];
    jwtKey?: string;
    secretKey?: string;
  } = {};

  if (config.clerkAuthorizedParties.length > 0) {
    options.authorizedParties = config.clerkAuthorizedParties;
  }

  if (config.clerkJwtKey) {
    options.jwtKey = config.clerkJwtKey;
  }

  if (config.clerkSecretKey) {
    options.secretKey = config.clerkSecretKey;
  }

  return verifyToken(sessionToken, options);
}

export async function resolveClerkIdentity(sessionToken: string, config: AuthConfig): Promise<ResolvedClerkIdentity> {
  const claims = await verifyClerkSessionToken(sessionToken, config);
  const sub = typeof claims.sub === 'string' ? claims.sub : '';
  if (!sub) {
    throw new Error('Clerk session token is missing a subject.');
  }

  const clerkUser = await getClerkClient(config).users.getUser(sub);
  const email = clerkUser.primaryEmailAddress?.emailAddress
    ?? clerkUser.emailAddresses[0]?.emailAddress
    ?? `${sub}@users.trackit.local`;
  const name = clerkUser.fullName ?? clerkUser.firstName ?? email;

  return {
    sub,
    email,
    name,
    picture: clerkUser.imageUrl || undefined
  };
}

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

export function buildConfig(): AuthConfig {
  return {
    clerkAuthorizedParties: (process.env.CLERK_AUTHORIZED_PARTIES || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    clerkJwtKey: process.env.CLERK_JWT_KEY || '',
    clerkSecretKey: process.env.CLERK_SECRET_KEY || '',
    jwtSecret: process.env.JWT_SECRET || 'local-secret',
    jwtExpirySeconds: Number(process.env.JWT_EXPIRY_SECONDS || 3600),
    audience: process.env.JWT_AUDIENCE || 'trackit-app'
  };
}

function getClerkClient(config: AuthConfig): ReturnType<typeof createClerkClient> {
  if (!config.clerkSecretKey) {
    throw new Error('CLERK_SECRET_KEY is required to resolve Clerk user profiles.');
  }

  if (!cachedClerkClient || cachedClerkSecretKey !== config.clerkSecretKey) {
    cachedClerkClient = createClerkClient({ secretKey: config.clerkSecretKey });
    cachedClerkSecretKey = config.clerkSecretKey;
  }

  return cachedClerkClient;
}
