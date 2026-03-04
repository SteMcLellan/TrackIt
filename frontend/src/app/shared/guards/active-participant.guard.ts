import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ParticipantService } from '../services/participant.service';

/**
 * Prevents rendering routes that require an active participant selection.
 *
 * - If the user has exactly one participant: auto-select it.
 * - If the user has zero participants: route to the participant start prompt.
 * - If the user has multiple participants and none selected: route to participant selection.
 */
export const ActiveParticipantGuard: CanActivateFn = () => {
  const participantsService = inject(ParticipantService);
  const router = inject(Router);
  const currentUrl = router.url || '';

  if (participantsService.activeParticipantId()) {
    return true;
  }

  // Profile is the fallback page for users without an active participant.
  // Allow it through to avoid redirect loops when this guard is applied there.
  if (currentUrl.startsWith('/profile')) {
    return true;
  }

  return participantsService.listParticipants(2).pipe(
    map((response) => {
      if (response.items.length === 0) {
        return router.parseUrl('/setup');
      }
      if (response.items.length === 1) {
        participantsService.setActiveParticipant(response.items[0].id);
        return true;
      }
      return router.parseUrl('/profile');
    }),
    catchError(() => of(router.parseUrl('/profile')))
  );
};
