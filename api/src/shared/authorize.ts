import { HttpRequest, InvocationContext } from '@azure/functions';
import jwt from 'jsonwebtoken';
import { AppJwtPayload, buildConfig } from './auth';

/**
 * Validates the app JWT from the Authorization header and returns its payload.
 */
export function authorize(context: InvocationContext, req: HttpRequest): AppJwtPayload {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) {
    const error = new Error('Missing app token') as Error & { status: number };
    error.status = 401;
    throw error;
  }
  const config = buildConfig();
  return jwt.verify(token, config.jwtSecret, { audience: config.audience }) as AppJwtPayload;
}
