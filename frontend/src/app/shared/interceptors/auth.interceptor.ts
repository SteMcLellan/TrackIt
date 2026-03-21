import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ClerkService } from '../services/clerk.service';
import { isSameOriginApiRequest } from './api-request.util';

/**
 * Attaches a fresh Clerk session token as Authorization: Bearer on API requests.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const clerk = inject(ClerkService);
  if (!auth.isAuthenticated()) {
    return next(req);
  }
  if (!isSameOriginApiRequest(req)) {
    return next(req);
  }
  if (req.headers.has('Authorization')) {
    return next(req);
  }
  return from(clerk.getSessionToken()).pipe(
    switchMap(token => {
      if (!token) {
        return next(req);
      }
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    })
  );
};
