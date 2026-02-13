import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CollectionResponse } from '../models/collection';
import { Participant } from '../models/participant';

export type CreateParticipantRequest = {
  displayName?: string;
  birthDate: string;
};

export type CreateParticipantResponse = Omit<Participant, 'role'>;

export type UpdateParticipantRequest = {
  displayName?: string;
  birthDate?: string;
};

@Injectable({ providedIn: 'root' })
export class ParticipantService {
  private readonly http = inject(HttpClient);
  private readonly activeParticipantIdSignal = signal<string | null>(null);
  readonly activeParticipantId = this.activeParticipantIdSignal.asReadonly();

  listParticipants(pageSize?: number) {
    let params = new HttpParams();
    if (pageSize) {
      params = params.set('pageSize', String(pageSize));
    }
    return this.http.get<CollectionResponse<Participant>>(`${environment.apiBaseUrl}/participants`, { params });
  }

  createParticipant(request: CreateParticipantRequest) {
    return this.http.post<CreateParticipantResponse>(`${environment.apiBaseUrl}/participants`, request);
  }

  updateParticipant(participantId: string, request: UpdateParticipantRequest) {
    return this.http.patch<Participant>(`${environment.apiBaseUrl}/participants/${participantId}`, request);
  }

  setActiveParticipant(participantId: string) {
    this.activeParticipantIdSignal.set(participantId);
  }

  clearActiveParticipant() {
    this.activeParticipantIdSignal.set(null);
  }
}
