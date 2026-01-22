import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Blocks access to protected routes when the user is not authenticated.
 * Preserves the attempted URL as a returnUrl query parameter for post-login redirect.
 */
export const AuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isAuthed = auth.isAuthenticated();

  if (!isAuthed) {
    // Preserve the attempted URL for redirect after login
    router.navigate(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  return isAuthed;
};
