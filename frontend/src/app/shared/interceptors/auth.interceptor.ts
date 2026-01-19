import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Adds the app JWT to outgoing requests for authenticated users.
 */
const APP_TOKEN_HEADER = 'x-trackit-app-token';

function isSameOriginApiRequest(req: HttpRequest<unknown>): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const resolved = new URL(req.url, window.location.origin);
  return resolved.origin === window.location.origin && resolved.pathname.startsWith('/api/');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (!auth.isAuthenticated()) {
    return next(req);
  }
  if (!isSameOriginApiRequest(req)) {
    return next(req);
  }
  if (req.headers.has('Authorization')) {
    return next(req);
  }
  if (req.headers.has(APP_TOKEN_HEADER)) {
    return next(req);
  }
  const token = auth.appUser().token;
  if (!token) {
    return next(req);
  }
  return next(
    req.clone({
      setHeaders: {
        [APP_TOKEN_HEADER]: token
      }
    })
  );
};
