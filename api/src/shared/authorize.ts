import { HttpRequest, InvocationContext } from '@azure/functions';
import jwt from 'jsonwebtoken';
import { AppJwtPayload, buildConfig } from './auth';

export function authorize(context: InvocationContext, req: HttpRequest): AppJwtPayload {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) {
    const error: any = new Error('Missing app token');
    error.status = 401;
    throw error;
  }
  const config = buildConfig();
  return jwt.verify(token, config.jwtSecret, { audience: config.audience }) as AppJwtPayload;
}
