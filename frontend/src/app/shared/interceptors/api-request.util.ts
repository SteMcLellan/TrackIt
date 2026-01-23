import { HttpRequest } from '@angular/common/http';

export function isSameOriginApiRequest(req: HttpRequest<unknown>): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const resolved = new URL(req.url, window.location.origin);
  return resolved.origin === window.location.origin && resolved.pathname.startsWith('/api/');
}
