import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CollectionResponse } from '../models/collection';
import {
  DailyReflection,
  DailyReflectionSummaryResponse,
  UpsertDailyReflectionRequest
} from '../models/daily-reflection';

export type ListDailyReflectionsOptions = {
  startDate: string;
  endDate: string;
  pageSize?: number;
  nextToken?: string;
};

@Injectable({ providedIn: 'root' })
export class DailyReflectionService {
  private readonly http = inject(HttpClient);

  listReflections(participantId: string, options: ListDailyReflectionsOptions) {
    let params = new HttpParams()
      .set('startDate', options.startDate)
      .set('endDate', options.endDate)
      .set('pageSize', String(options.pageSize ?? 25));

    if (options.nextToken) {
      params = params.set('nextToken', options.nextToken);
    }

    return this.http.get<CollectionResponse<DailyReflection>>(
      `${environment.apiBaseUrl}/participants/${participantId}/daily-reflections`,
      { params }
    );
  }

  getSummary(participantId: string, endDate: string, days = 7) {
    const params = new HttpParams()
      .set('endDate', endDate)
      .set('days', String(days));

    return this.http.get<DailyReflectionSummaryResponse>(
      `${environment.apiBaseUrl}/participants/${participantId}/daily-reflections/summary`,
      { params }
    );
  }

  upsertReflection(
    participantId: string,
    logLocalDate: string,
    request: UpsertDailyReflectionRequest
  ) {
    return this.http.put<DailyReflection>(
      `${environment.apiBaseUrl}/participants/${participantId}/daily-reflections/${logLocalDate}`,
      request
    );
  }
}
