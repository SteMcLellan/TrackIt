import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { TimelineResponse, TimelineSourceType, TimelineEvent } from '../models/timeline-event';

export type ListTimelineOptions = {
  startUtc: string;
  endUtc: string;
  types?: TimelineSourceType[];
  tags?: string[];
  top?: number;
  skipToken?: string;
  orderBy?: 'eventAtUtc asc' | 'eventAtUtc desc';
  clusterMinutes?: number;
};

export type TimelineContextResponse = {
  anchor: TimelineEvent;
  minutes: number;
  rangeStartUtc: string;
  rangeEndUtc: string;
  items: TimelineEvent[];
};

@Injectable({ providedIn: 'root' })
export class TimelineService {
  private readonly http = inject(HttpClient);

  listTimeline(participantId: string, options: ListTimelineOptions) {
    let params = new HttpParams()
      .set('$startUtc', options.startUtc)
      .set('$endUtc', options.endUtc)
      .set('$top', String(options.top ?? 100))
      .set('$orderBy', options.orderBy ?? 'eventAtUtc desc');

    if (options.skipToken) {
      params = params.set('$skipToken', options.skipToken);
    }
    if (options.types && options.types.length > 0) {
      params = params.set('$types', options.types.join(','));
    }
    if (options.tags && options.tags.length > 0) {
      params = params.set('$tags', options.tags.join(','));
    }
    if (options.clusterMinutes) {
      params = params.set('$clusterMinutes', String(options.clusterMinutes));
    }

    return this.http.get<TimelineResponse>(
      `${environment.apiBaseUrl}/participants/${participantId}/timeline`,
      { params }
    );
  }

  getContext(
    participantId: string,
    sourceType: TimelineSourceType,
    sourceId: string,
    minutes = 15
  ) {
    const params = new HttpParams().set('minutes', String(minutes));
    return this.http.get<TimelineContextResponse>(
      `${environment.apiBaseUrl}/participants/${participantId}/timeline/context/${sourceType}/${sourceId}`,
      { params }
    );
  }
}
