import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BehaviorFunction, BehaviorIncident } from '../models/behavior-incident';
import { CollectionResponse } from '../models/collection';

export type CreateBehaviorIncidentRequest = {
  antecedent: string;
  behavior: string;
  consequence: string;
  occurredAtUtc: string;
  place: string;
  function: BehaviorFunction;
};

export type ListBehaviorIncidentsOptions = {
  pageSize?: number;
  nextToken?: string;
  function?: BehaviorFunction;
  fromUtc?: string;
  toUtc?: string;
};

export type UpdateBehaviorIncidentRequest = {
  antecedent?: string;
  behavior?: string;
  consequence?: string;
  occurredAtUtc?: string;
  place?: string;
  function?: BehaviorFunction;
};

@Injectable({ providedIn: 'root' })
export class BehaviorIncidentService {
  private readonly http = inject(HttpClient);

  createIncident(participantId: string, request: CreateBehaviorIncidentRequest) {
    return this.http.post<BehaviorIncident>(
      `${environment.apiBaseUrl}/participants/${participantId}/incidents`,
      request
    );
  }

  listIncidents(participantId: string, options: ListBehaviorIncidentsOptions = {}) {
    let params = new HttpParams();
    if (options.pageSize) {
      params = params.set('pageSize', String(options.pageSize));
    }
    if (options.nextToken) {
      params = params.set('nextToken', options.nextToken);
    }
    if (options.function) {
      params = params.set('function', options.function);
    }
    if (options.fromUtc) {
      params = params.set('fromUtc', options.fromUtc);
    }
    if (options.toUtc) {
      params = params.set('toUtc', options.toUtc);
    }

    return this.http.get<CollectionResponse<BehaviorIncident>>(
      `${environment.apiBaseUrl}/participants/${participantId}/incidents`,
      { params }
    );
  }

  getIncident(participantId: string, incidentId: string) {
    return this.http.get<BehaviorIncident>(
      `${environment.apiBaseUrl}/participants/${participantId}/incidents/${incidentId}`
    );
  }

  updateIncident(participantId: string, incidentId: string, request: UpdateBehaviorIncidentRequest) {
    return this.http.patch<BehaviorIncident>(
      `${environment.apiBaseUrl}/participants/${participantId}/incidents/${incidentId}`,
      request
    );
  }

  deleteIncident(participantId: string, incidentId: string) {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/participants/${participantId}/incidents/${incidentId}`
    );
  }
}
