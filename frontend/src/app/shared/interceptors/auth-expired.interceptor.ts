import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { isSameOriginApiRequest } from './api-request.util';

export const authExpiredInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isSameOriginApiRequest(req)) {
        auth.logout();
        if (!router.url.startsWith('/login')) {
          router.navigate(['/login'], {
            queryParams: { returnUrl: router.url }
          });
        }
      }
      return throwError(() => error);
    })
  );
};
