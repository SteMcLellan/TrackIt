import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const AuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isAuthed = auth.isAuthenticated();

  if (!isAuthed) {
    router.navigate(['/login']);
  }

  return isAuthed;
};
