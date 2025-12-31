import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Blocks access to protected routes when the user is not authenticated.
 */
export const AuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isAuthed = auth.isAuthenticated();

  if (!isAuthed) {
    router.navigate(['/login']);
  }

  return isAuthed;
};
