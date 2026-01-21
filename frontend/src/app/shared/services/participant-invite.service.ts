import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ParticipantInviteResponse } from '../models/participant-invite';

@Injectable({ providedIn: 'root' })
export class ParticipantInviteService {
  private readonly http = inject(HttpClient);

  createInvite(participantId: string) {
    return this.http.post<ParticipantInviteResponse>(
      `${environment.apiBaseUrl}/participants/${participantId}/invites`,
      {}
    );
  }
}
