import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ClerkService } from '../services/clerk.service';
import { isSameOriginApiRequest } from './api-request.util';

/**
 * Attaches a fresh Clerk session token as x-trackit-app-token on API requests.
 * Authorization header is intentionally avoided: Azure Static Web Apps intercepts
 * and mangles it before the request reaches the Azure Functions backend.
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
  if (req.headers.has('x-trackit-app-token')) {
    return next(req);
  }
  return from(clerk.getSessionToken()).pipe(
    switchMap(token => {
      if (!token) {
        return next(req);
      }
      return next(req.clone({ setHeaders: { 'x-trackit-app-token': token } }));
    })
  );
};
