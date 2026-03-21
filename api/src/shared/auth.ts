import { createClerkClient, verifyToken } from '@clerk/backend';

export interface AuthConfig {
  clerkAuthorizedParties: string[];
  clerkJwtKey: string;
  clerkSecretKey: string;
}

export interface ResolvedClerkClaims {
  sub: string;
  metadata?: {
    roles?: string[];
  };
}

export interface ResolvedClerkIdentity {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

let cachedClerkClient: ReturnType<typeof createClerkClient> | null = null;
let cachedClerkSecretKey = '';

export async function verifyClerkSessionToken(sessionToken: string, config: AuthConfig): Promise<ResolvedClerkClaims> {
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

  const payload = await verifyToken(sessionToken, options);
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  if (!sub) {
    throw new Error('Clerk session token is missing a subject.');
  }

  const rawMetadata = (payload as Record<string, unknown>)['metadata'];
  let metadata: { roles?: string[] } | undefined;
  if (rawMetadata !== null && rawMetadata !== undefined && typeof rawMetadata === 'object') {
    const metaObj = rawMetadata as Record<string, unknown>;
    const rawRoles = metaObj['roles'];
    const roles = Array.isArray(rawRoles)
      ? rawRoles.filter((r): r is string => typeof r === 'string')
      : undefined;
    metadata = { roles };
  }

  return { sub, metadata };
}

export async function resolveClerkIdentity(sessionToken: string, config: AuthConfig): Promise<ResolvedClerkIdentity> {
  const claims = await verifyClerkSessionToken(sessionToken, config);
  const sub = claims.sub;

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

export function buildConfig(): AuthConfig {
  return {
    clerkAuthorizedParties: (process.env.CLERK_AUTHORIZED_PARTIES || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    clerkJwtKey: process.env.CLERK_JWT_KEY || '',
    clerkSecretKey: process.env.CLERK_SECRET_KEY || ''
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
