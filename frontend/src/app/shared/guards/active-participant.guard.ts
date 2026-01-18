import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ParticipantService } from '../services/participant.service';

/**
 * Prevents rendering routes that require an active participant selection.
 *
 * - If the user has zero participants: route to the participant start prompt.
 * - If the user has participants but none selected: route to participant selection.
 */
export const ActiveParticipantGuard: CanActivateFn = () => {
  const participantsService = inject(ParticipantService);
  const router = inject(Router);

  if (participantsService.activeParticipantId()) {
    return true;
  }

  return participantsService.listParticipants(1).pipe(
    map((response) => {
      if (response.items.length === 0) {
        return router.parseUrl('/participants/start');
      }
      return router.parseUrl('/participants');
    }),
    catchError(() => of(router.parseUrl('/participants')))
  );
};
