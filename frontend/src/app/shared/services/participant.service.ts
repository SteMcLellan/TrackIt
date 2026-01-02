import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CollectionResponse } from '../models/collection';
import { Participant } from '../models/participant';

@Injectable({ providedIn: 'root' })
export class ParticipantService {
  private readonly http = inject(HttpClient);

  listParticipants(pageSize?: number) {
    let params = new HttpParams();
    if (pageSize) {
      params = params.set('pageSize', String(pageSize));
    }
    return this.http.get<CollectionResponse<Participant>>(`${environment.apiBaseUrl}/participants`, { params });
  }
}
