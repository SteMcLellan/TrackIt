import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CollectionResponse } from '../models/collection';
import { MedicationLog } from '../models/medication-log';

export type UpsertMedicationLogRequest = {
  status: 'taken' | 'not_taken';
  logTzOffsetMinutes: number;
  occurrenceKey?: string;
};

@Injectable({ providedIn: 'root' })
export class MedicationLogService {
  private readonly http = inject(HttpClient);

  listLogs(participantId: string, startDate: string, endDate: string, medicationIds?: string[]) {
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('pageSize', '200');

    if (medicationIds && medicationIds.length > 0) {
      params = params.set('medicationIds', medicationIds.join(','));
    }

    return this.http.get<CollectionResponse<MedicationLog>>(
      `${environment.apiBaseUrl}/participants/${participantId}/medication-logs`,
      { params }
    );
  }

  upsertLog(
    participantId: string,
    medicationId: string,
    logLocalDate: string,
    request: UpsertMedicationLogRequest
  ) {
    return this.http.put<MedicationLog>(
      `${environment.apiBaseUrl}/participants/${participantId}/medication-logs/${medicationId}/${logLocalDate}`,
      request
    );
  }

  getLog(participantId: string, logId: string) {
    return this.http.get<MedicationLog>(
      `${environment.apiBaseUrl}/participants/${participantId}/medication-logs/${logId}`
    );
  }
}
