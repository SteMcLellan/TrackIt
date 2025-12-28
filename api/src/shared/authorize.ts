import { Context, HttpRequest } from '@azure/functions';
import jwt from 'jsonwebtoken';
import { AppJwtPayload, buildConfig } from './auth';

export function authorize(context: Context, req: HttpRequest): AppJwtPayload {
  const token = req.headers['authorization']?.replace('Bearer ', '') || '';
  if (!token) {
    const error: any = new Error('Missing app token');
    error.status = 401;
    throw error;
  }
  const config = buildConfig();
  return jwt.verify(token, config.jwtSecret, { audience: config.audience }) as AppJwtPayload;
}
