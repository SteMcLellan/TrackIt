import { HttpResponseInit } from '@azure/functions';
import { ResolvedClerkClaims } from './auth';

export function isAdmin(payload: ResolvedClerkClaims): boolean {
  return Array.isArray(payload.metadata?.roles) && (payload.metadata?.roles ?? []).includes('admin');
}

export function requireAdmin(payload: ResolvedClerkClaims): HttpResponseInit | null {
  if (isAdmin(payload)) {
    return null;
  }
  return { status: 403, jsonBody: { message: 'Admin role required.' } };
}
