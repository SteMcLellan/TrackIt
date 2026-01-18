import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card/card.component';
import { ParticipantService } from '../../shared/services/participant.service';
import { MedicationService } from '../../shared/services/medication.service';
import { MedicationLogService } from '../../shared/services/medication-log.service';
import { Medication } from '../../shared/models/medication';
import { MedicationLog } from '../../shared/models/medication-log';
import { CollectionResponse } from '../../shared/models/collection';
import { environment } from '../../../environments/environment';

type MedicationsResponse = CollectionResponse<Medication>;
type MedicationLogsResponse = CollectionResponse<MedicationLog>;

@Component({
  selector: 'app-medication-log',
  imports: [CardComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <app-card class="card">
        <div class="header">
          <div>
            <h2>Medication log</h2>
            <p class="muted">Quickly log today’s medications for the active participant.</p>
          </div>
          <div class="header-actions">
            <a class="button secondary" routerLink="/medications/history">Adherence</a>
            <a class="button secondary" routerLink="/medications/list">Medication list</a>
          </div>
        </div>

        @if (!activeParticipantId()) {
          <p class="error" role="alert">Select a participant to log medications.</p>
          <a class="button secondary" routerLink="/participants">Select participant</a>
        } @else {
          <div class="filters">
            <div class="field">
              <label for="logDate">Log date</label>
              <input
                id="logDate"
                type="date"
                [min]="minLogDate()"
                [max]="maxLogDate()"
                [value]="logLocalDate()"
                (change)="onDateChange($event)"
              />
            </div>
            <div class="hint">You can edit logs up to the last 30 days.</div>
          </div>
        }
      </app-card>

      <app-card class="card">
        <div class="header">
          <div>
            <h2>Daily checklist</h2>
            <p class="muted">Tap once to mark Taken or Not taken.</p>
          </div>
        </div>

        @if (!activeParticipantId()) {
          <p class="error" role="alert">Select a participant to view the checklist.</p>
        } @else if (medicationsResource.isLoading()) {
          <p class="muted">Loading medications...</p>
        } @else if (medicationsResource.error()) {
          <p class="error" role="alert">Unable to load medications.</p>
        } @else if (activeMedicationsForDate().length === 0) {
          <p class="muted">No active medications for this date.</p>
          <a class="button" routerLink="/medications/list">Add medication</a>
        } @else if (logsResource.isLoading()) {
          <p class="muted">Loading log entries...</p>
        } @else if (logsResource.error()) {
          <p class="error" role="alert">Unable to load log entries.</p>
        } @else {
          <ul class="list" role="list">
            @for (medication of activeMedicationsForDate(); track medication.id) {
              <li class="item">
                <div class="item-main">
                  <div class="title">{{ medication.name }}</div>
                  <div class="meta">
                    <span>{{ medication.dosageText }}</span>
                    <span class="dot">·</span>
                    <span>{{ frequencyLabel(medication.frequencyText) }}</span>
                  </div>
                  <div class="status">
                    <span
                      class="badge"
                      [class.taken]="logStatus(medication.id) === 'taken'"
                      [class.not-taken]="logStatus(medication.id) === 'not_taken'"
                      [class.not-logged]="!logStatus(medication.id)"
                    >
                      {{ statusLabel(logStatus(medication.id)) }}
                    </span>
                  </div>
                </div>
                <div class="item-actions">
                  <button
                    class="button"
                    type="button"
                    [disabled]="isSaving(medication.id)"
                    (click)="markMedication(medication, 'taken')"
                  >
                    Taken
                  </button>
                  <button
                    class="button secondary"
                    type="button"
                    [disabled]="isSaving(medication.id)"
                    (click)="markMedication(medication, 'not_taken')"
                  >
                    Not taken
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      </app-card>
    </div>
  `,
  styles: [
    `
      .layout {
        display: grid;
        gap: var(--space-4, 1rem);
      }
      .card {
        width: 100%;
        margin: 0;
        box-sizing: border-box;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
        margin-bottom: var(--space-3, 0.75rem);
      }
      .header-actions {
        display: flex;
        gap: var(--space-2, 0.5rem);
        flex-wrap: wrap;
      }
      h2 {
        margin: 0 0 var(--space-1, 0.25rem);
      }
      .muted {
        margin: 0;
        color: var(--color-text-muted, #64748b);
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-primary, #0c4a6e);
        color: #fff;
        padding: 0.55rem 1.1rem;
        border-radius: var(--radius-2, 0.5rem);
        text-decoration: none;
        font-weight: 600;
        border: none;
        cursor: pointer;
      }
      .button.secondary {
        background: #fff;
        color: var(--color-primary, #0c4a6e);
        border: 1px solid var(--color-primary, #0c4a6e);
      }
      .button[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .filters {
        display: grid;
        gap: var(--space-2, 0.5rem);
        margin-top: var(--space-2, 0.5rem);
      }
      .field label {
        display: block;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }
      .field input {
        width: 100%;
        padding: 0.55rem 0.6rem;
        border-radius: var(--radius-2, 0.5rem);
        border: 1px solid #cbd5f5;
        font-family: inherit;
        box-sizing: border-box;
      }
      .hint {
        color: var(--color-text-muted, #64748b);
        font-size: 0.9rem;
      }
      .list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: var(--space-3, 0.75rem);
      }
      .item {
        border: 1px solid #e2e8f0;
        border-radius: var(--radius-2, 0.5rem);
        padding: var(--space-3, 0.75rem);
        background: #fff;
        display: flex;
        justify-content: space-between;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
      }
      .item-main {
        display: grid;
        gap: 0.25rem;
      }
      .title {
        font-weight: 700;
      }
      .meta {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        color: var(--color-text-muted, #64748b);
        flex-wrap: wrap;
      }
      .status {
        margin-top: 0.35rem;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        font-weight: 700;
        font-size: 0.75rem;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        background: #e2e8f0;
        color: #334155;
      }
      .badge.taken {
        background: rgba(34, 197, 94, 0.16);
        color: #166534;
      }
      .badge.not-taken {
        background: rgba(239, 68, 68, 0.16);
        color: #991b1b;
      }
      .badge.not-logged {
        background: rgba(148, 163, 184, 0.2);
        color: #475569;
      }
      .item-actions {
        display: flex;
        gap: 0.75rem;
        align-items: center;
      }
      .dot {
        color: var(--color-text-muted, #94a3b8);
      }
      .error {
        margin: 0;
        color: #b91c1c;
        font-weight: 600;
      }
      @media (min-width: 900px) {
        .filters {
          grid-template-columns: minmax(0, 240px) 1fr;
          align-items: end;
        }
      }
    `
  ]
})
export class MedicationLogComponent {
  private readonly participants = inject(ParticipantService);
  private readonly medicationsApi = inject(MedicationService);
  private readonly logsApi = inject(MedicationLogService);

  readonly activeParticipantId = this.participants.activeParticipantId;
  private readonly refreshTick = signal(0);
  readonly logLocalDate = signal(this.formatLocalDate(new Date()));
  readonly savingMap = signal<Record<string, boolean>>({});

  readonly minLogDate = computed(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return this.formatLocalDate(date);
  });

  readonly maxLogDate = computed(() => this.formatLocalDate(new Date()));

  readonly medicationsResource = httpResource<MedicationsResponse>(() => {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/medications`,
        method: 'GET',
        params: { pageSize: '1' }
      };
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/medications`,
      method: 'GET',
      params: { pageSize: '200' }
    };
  });

  readonly logsResource = httpResource<MedicationLogsResponse>(() => {
    const participantId = this.activeParticipantId();
    const logDate = this.logLocalDate();
    this.refreshTick();
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/medication-logs`,
        method: 'GET',
        params: { startDate: logDate, endDate: logDate, pageSize: '1' }
      };
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/medication-logs`,
      method: 'GET',
      params: { startDate: logDate, endDate: logDate, pageSize: '200' }
    };
  });

  readonly medications = computed(() =>
    this.medicationsResource.hasValue() ? this.medicationsResource.value().items : []
  );

  readonly logs = computed(() => (this.logsResource.hasValue() ? this.logsResource.value().items : []));

  readonly activeMedicationsForDate = computed(() => {
    const date = this.logLocalDate();
    return this.medications()
      .filter((item) => !item.archivedAtUtc)
      .filter((item) => item.startDateUtc <= date)
      .filter((item) => !item.endDateUtc || item.endDateUtc >= date);
  });

  private readonly logMap = computed(() => {
    const map = new Map<string, MedicationLog>();
    for (const log of this.logs()) {
      map.set(log.medicationId, log);
    }
    return map;
  });

  readonly frequencyOptions = [
    { value: 'once-daily', label: 'Once daily' },
    { value: 'twice-daily', label: 'Twice daily' },
    { value: 'three-times-daily', label: 'Three times daily' },
    { value: 'four-times-daily', label: 'Four times daily' },
    { value: 'every-other-day', label: 'Every other day' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'as-needed', label: 'As needed' }
  ] as const;
  private readonly frequencyLabelMap: Record<string, string> = Object.fromEntries(
    this.frequencyOptions.map((option) => [option.value, option.label])
  );

  onDateChange(event: Event) {
    const target = event.target as HTMLInputElement | null;
    if (!target?.value) {
      return;
    }
    this.logLocalDate.set(target.value);
  }

  markMedication(medication: Medication, status: 'taken' | 'not_taken') {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return;
    }
    const logDate = this.logLocalDate();
    this.setSaving(medication.id, true);
    const logTzOffsetMinutes = -new Date().getTimezoneOffset();
    this.logsApi
      .upsertLog(participantId, medication.id, logDate, {
        status,
        logTzOffsetMinutes,
        occurrenceKey: 'daily'
      })
      .subscribe({
        next: () => {
          this.setSaving(medication.id, false);
          this.refreshTick.update((value) => value + 1);
        },
        error: () => {
          this.setSaving(medication.id, false);
        }
      });
  }

  logStatus(medicationId: string) {
    return this.logMap().get(medicationId)?.status ?? null;
  }

  statusLabel(status: 'taken' | 'not_taken' | null) {
    if (status === 'taken') {
      return 'Taken';
    }
    if (status === 'not_taken') {
      return 'Not taken';
    }
    return 'Not logged';
  }

  frequencyLabel(value: string) {
    return this.frequencyLabelMap[value] ?? value;
  }

  isSaving(medicationId: string) {
    return !!this.savingMap()[medicationId];
  }

  private setSaving(medicationId: string, value: boolean) {
    this.savingMap.update((current) => ({ ...current, [medicationId]: value }));
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
