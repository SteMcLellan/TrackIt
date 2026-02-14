import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { TimelineResponse, TimelineSourceType, TimelineEvent } from '../models/timeline-event';

export type ListTimelineOptions = {
  date: string;
  cursorDate?: string;
  days?: number;
  types?: TimelineSourceType[];
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
    const days = options.days ?? 1;

    let params = new HttpParams()
      .set('date', options.date)
      .set('days', String(days));

    if (options.cursorDate) {
      params = params.set('cursorDate', options.cursorDate);
    }
    if (options.types && options.types.length > 0) {
      params = params.set('$types', options.types.join(','));
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
