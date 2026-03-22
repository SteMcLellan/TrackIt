import { HttpRequest, InvocationContext } from '@azure/functions';
import { buildConfig, ResolvedClerkClaims, verifyClerkSessionToken } from './auth';

/**
 * Validates the Clerk session token from the x-trackit-app-token header and returns its claims.
 * The Authorization header is intentionally avoided: Azure Static Web Apps intercepts and
 * mangles it before the request reaches the Azure Functions backend.
 */
export async function authorize(_context: InvocationContext, req: HttpRequest): Promise<ResolvedClerkClaims> {
  const token = req.headers.get('x-trackit-app-token') || '';
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
