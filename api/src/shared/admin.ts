import { HttpResponseInit } from '@azure/functions';
import { AppJwtPayload } from './auth';

export function isAdmin(payload: AppJwtPayload): boolean {
  return (
    (Array.isArray(payload.roles) && payload.roles.includes('admin')) ||
    payload.role === 'admin'
  );
}

export function requireAdmin(payload: AppJwtPayload): HttpResponseInit | null {
  if (isAdmin(payload)) {
    return null;
  }
  return { status: 403, jsonBody: { message: 'Admin role required.' } };
}
