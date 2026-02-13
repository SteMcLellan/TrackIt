import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  ParticipantInviteResponse,
  ActiveParticipantInviteResponse,
  AcceptInviteResponse,
  ParticipantMember
} from '../models/participant-invite';
import { CollectionResponse } from '../models/collection';

@Injectable({ providedIn: 'root' })
export class ParticipantInviteService {
  private readonly http = inject(HttpClient);

  getActiveInvite(participantId: string) {
    return this.http.get<ActiveParticipantInviteResponse>(
      `${environment.apiBaseUrl}/participants/${participantId}/invites/active`
    );
  }

  createInvite(participantId: string) {
    return this.http.post<ParticipantInviteResponse>(
      `${environment.apiBaseUrl}/participants/${participantId}/invites`,
      {}
    );
  }

  acceptInvite(participantId: string, inviteId: string) {
    return this.http.post<AcceptInviteResponse>(
      `${environment.apiBaseUrl}/participants/${participantId}/invites/${inviteId}/accept`,
      {}
    );
  }

  listMembers(participantId: string) {
    return this.http.get<CollectionResponse<ParticipantMember>>(
      `${environment.apiBaseUrl}/participants/${participantId}/members`
    );
  }

  revokeMember(participantId: string, userId: string) {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/participants/${participantId}/members/${userId}`
    );
  }
}
