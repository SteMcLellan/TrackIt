import { HttpRequest, InvocationContext } from '@azure/functions';
import { buildConfig, ResolvedClerkClaims, verifyClerkSessionToken } from './auth';

/**
 * Validates the Clerk session token from the Authorization header and returns its claims.
 */
export async function authorize(_context: InvocationContext, req: HttpRequest): Promise<ResolvedClerkClaims> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!token) {
    const error = new Error('Missing authorization token') as Error & { status: number };
    error.status = 401;
    throw error;
  }
  const config = buildConfig();
  try {
    return await verifyClerkSessionToken(token, config);
  } catch {
    const error = new Error('Invalid authorization token') as Error & { status: number };
    error.status = 401;
    throw error;
  }
}
