import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ParticipantService } from '../services/participant.service';

/**
 * Routes parents with zero participants to the participant start prompt.
 */
export const ParticipantStartGuard: CanActivateFn = () => {
  const participantsService = inject(ParticipantService);
  const router = inject(Router);

  return participantsService.listParticipants(1).pipe(
    map((response) => {
      if (response.items.length === 0) {
        return router.parseUrl('/participants/start');
      }
      return true;
    }),
    catchError(() => of(true))
  );
};
