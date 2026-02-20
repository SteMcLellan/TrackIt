import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CollectionResponse } from '../models/collection';
import { IntervalSchedule, Medication, MedicationFrequency } from '../models/medication';

export type CreateMedicationRequest = {
  name: string;
  dosageText: string;
  frequency: MedicationFrequency;
  intervalSchedule?: IntervalSchedule;
  startDateUtc: string;
  endDateUtc?: string | null;
  notes?: string | null;
};

export type UpdateMedicationRequest = Partial<{
  name: string;
  dosageText: string;
  frequency: MedicationFrequency;
  intervalSchedule: IntervalSchedule;
  startDateUtc: string;
  endDateUtc: string | null;
  notes: string | null;
  archivedAtUtc: string | null;
}>;

@Injectable({ providedIn: 'root' })
export class MedicationService {
  private readonly http = inject(HttpClient);

  listMedications(participantId: string, includeArchived = false, pageSize = 100) {
    let params = new HttpParams().set('pageSize', String(pageSize));
    if (includeArchived) {
      params = params.set('includeArchived', 'true');
    }
    return this.http.get<CollectionResponse<Medication>>(
      `${environment.apiBaseUrl}/participants/${participantId}/medications`,
      { params }
    );
  }

  createMedication(participantId: string, request: CreateMedicationRequest) {
    return this.http.post<Medication>(
      `${environment.apiBaseUrl}/participants/${participantId}/medications`,
      request
    );
  }

  updateMedication(participantId: string, medicationId: string, request: UpdateMedicationRequest) {
    return this.http.patch<Medication>(
      `${environment.apiBaseUrl}/participants/${participantId}/medications/${medicationId}`,
      request
    );
  }

  getMedication(participantId: string, medicationId: string) {
    return this.http.get<Medication>(
      `${environment.apiBaseUrl}/participants/${participantId}/medications/${medicationId}`
    );
  }
}
