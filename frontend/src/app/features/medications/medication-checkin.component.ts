import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CollectionResponse } from '../../shared/models/collection';
import { MedicationLog } from '../../shared/models/medication-log';
import { Medication } from '../../shared/models/medication';
import { MedicationLogService } from '../../shared/services/medication-log.service';
import { ParticipantService } from '../../shared/services/participant.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { MedicationDotsStripComponent } from './medication-dots-strip.component';
import { environment } from '../../../environments/environment';

type MedicationsResponse = CollectionResponse<Medication>;
type MedicationLogsResponse = CollectionResponse<MedicationLog>;

@Component({
  selector: 'app-medication-checkin',
  imports: [CardComponent, RouterLink, MedicationDotsStripComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card class="card">
      <div class="header">
        <h2>Medication check-in</h2>
        <a class="manage-link" routerLink="/medications">
          Manage medications
          <svg class="link-arrow" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
        </a>
        <p class="muted">Today: {{ todayLocalDate() }}</p>
      </div>

      @if (medicationsResource.isLoading() || logsResource.isLoading()) {
        <ul class="list skeleton-list" role="list" aria-label="Loading medication check-in">
          @for (i of [1, 2]; track i) {
            <li class="item skeleton-item">
              <div class="item-main">
                <app-skeleton width="140px" height="1.1rem" />
                <div class="meta-skeleton">
                  <app-skeleton width="80px" height="0.9rem" />
                  <app-skeleton width="60px" height="0.9rem" />
                </div>
              </div>

              <div class="item-dots">
                <app-skeleton width="100%" height="32px" radius="999px" />
              </div>

              <div class="item-actions">
                <app-skeleton variant="button" width="90px" height="44px" />
                <app-skeleton variant="button" width="110px" height="44px" />
              </div>
            </li>
          }
        </ul>
      } @else if (medicationsResource.error() || logsResource.error()) {
        <p class="error" role="alert">Unable to load medication check-in.</p>
        <a class="button secondary" routerLink="/medications">Open daily log</a>
      } @else if (activeMedicationsForToday().length === 0) {
        <p class="muted">No active medications for today.</p>
      } @else {
        @if (saveError()) {
          <p class="error" role="alert">{{ saveError() }}</p>
        }
        <ul class="list" role="list">
          @for (medication of activeMedicationsForToday(); track medication.id) {
            <li class="item">
              <div class="item-main">
                <div class="title">{{ medication.name }}</div>
                <div class="meta">
                  <span>{{ medication.dosageText }}</span>
                  <span class="dot">&middot;</span>
                  <span>{{ frequencyLabel(medication.frequencyText) }}</span>
                </div>
                </div>

              <div class="item-dots">
                <app-medication-dots-strip
                  [dates]="rangeDates()"
                  [statusesByDate]="statusesByMedicationId().get(medication.id) ?? {}"
                  [startDateUtc]="medication.startDateUtc"
                  [endDateUtc]="medication.endDateUtc"
                  [showRangeLabels]="true"
                />
              </div>

              <div class="item-actions">
                @switch (logStatus(medication.id, todayLocalDate())) {
                  @case ('taken') {
                    <button
                      class="status-button taken"
                      type="button"
                      [disabled]="isSaving(medication.id)"
                      (click)="markMedication(medication, 'not_taken')"
                    >
                      <svg class="status-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      Taken
                    </button>
                  }
                  @case ('not_taken') {
                    <button
                      class="status-button skipped"
                      type="button"
                      [disabled]="isSaving(medication.id)"
                      (click)="markMedication(medication, 'taken')"
                    >
                      <svg class="status-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                      </svg>
                      Skipped
                    </button>
                  }
                  @default {
                    <button
                      class="status-button pending"
                      type="button"
                      [disabled]="isSaving(medication.id)"
                      (click)="markMedication(medication, 'taken')"
                    >
                      <svg class="status-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      Take
                    </button>
                  }
                }
              </div>
            </li>
          }
        </ul>
      }
    </app-card>
  `,
  styles: [
    `
      .card {
        width: 100%;
        margin: 0;
        box-sizing: border-box;
      }
      .header {
        display: grid;
        gap: var(--space-1, 0.25rem);
        margin-bottom: var(--space-4, 1rem);
      }
      .manage-link {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        color: var(--color-text-muted, #64748b);
        text-decoration: none;
        font-size: var(--font-size-sm, 0.8125rem);
        font-weight: 500;
        transition: color var(--transition-fast, 120ms ease);
      }
      .manage-link:hover {
        color: var(--color-primary, #0c4a6e);
      }
      .link-arrow {
        width: 16px;
        height: 16px;
      }
      h2 {
        margin: 0 0 var(--space-1, 0.25rem);
      }
      .muted {
        margin: 0;
        color: var(--color-text-muted, #64748b);
      }
      .error {
        margin: 0;
        color: #b91c1c;
        font-weight: 600;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        background: var(--color-primary, #0c4a6e);
        color: #fff;
        padding: 0.7rem 1.1rem;
        min-height: 44px;
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
      .list {
        list-style: none;
        padding: 0;
        margin: var(--space-4, 1rem) 0 0;
        display: grid;
        gap: var(--space-4, 1rem);
      }
      .meta-skeleton {
        display: flex;
        gap: var(--space-2, 0.5rem);
        align-items: center;
      }
      .skeleton-item {
        padding: var(--space-4, 1rem);
      }
      .item {
        border: 1px solid #e2e8f0;
        border-radius: var(--radius-2, 0.5rem);
        padding: var(--space-4, 1rem);
        background: #fff;
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-3, 0.75rem);
      }
      @media (min-width: 860px) {
        .item {
          grid-template-columns: minmax(220px, 1fr) minmax(0, 1fr) auto;
          align-items: center;
        }
      }
      .item-main {
        display: grid;
        gap: 0.45rem;
      }
      .title {
        font-weight: 700;
      }
      .meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--color-text-muted, #64748b);
        flex-wrap: wrap;
      }
      .dot {
        color: var(--color-text-muted, #94a3b8);
      }
      .item-dots {
        display: flex;
        align-items: center;
        min-width: 0;
      }
      .item-actions {
        display: flex;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
        align-items: center;
      }
      .status-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.55rem 1rem;
        min-height: 40px;
        min-width: 100px;
        border-radius: var(--radius-full, 999px);
        font-weight: 600;
        font-size: var(--font-size-sm, 0.8125rem);
        border: none;
        cursor: pointer;
        transition: transform var(--transition-fast, 120ms ease),
                    box-shadow var(--transition-fast, 120ms ease),
                    background var(--transition-fast, 120ms ease);
      }
      .status-button:active:not([disabled]) {
        transform: scale(0.97);
      }
      .status-button[disabled] {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .status-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }
      .status-button.pending {
        background: var(--color-primary, #0c4a6e);
        color: #fff;
        box-shadow: 0 1px 3px rgba(12, 74, 110, 0.2);
      }
      .status-button.pending:hover:not([disabled]) {
        background: #0a3d5c;
        box-shadow: 0 2px 6px rgba(12, 74, 110, 0.25);
      }
      .status-button.taken {
        background: #dcfce7;
        color: #166534;
        box-shadow: 0 1px 3px rgba(22, 101, 52, 0.1);
      }
      .status-button.taken:hover:not([disabled]) {
        background: #bbf7d0;
        box-shadow: 0 2px 6px rgba(22, 101, 52, 0.15);
      }
      .status-button.skipped {
        background: #fef3c7;
        color: #92400e;
        box-shadow: 0 1px 3px rgba(146, 64, 14, 0.1);
      }
      .status-button.skipped:hover:not([disabled]) {
        background: #fde68a;
        box-shadow: 0 2px 6px rgba(146, 64, 14, 0.15);
      }
      @media (max-width: 520px) {
        .status-button {
          flex: 1;
          min-width: 0;
        }
      }
    `
  ]
})
export class MedicationCheckinComponent {
  private readonly participants = inject(ParticipantService);
  private readonly logsApi = inject(MedicationLogService);

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly rangeDays = input<7 | 14 | 30>(7);
  private readonly refreshTick = signal(0);

  readonly savingMap = signal<Record<string, boolean>>({});
  readonly saveError = signal<string | null>(null);

  readonly todayLocalDate = signal(this.formatLocalDate(new Date()));

  readonly rangeDates = computed(() => {
    const range = this.rangeDays();
    const today = new Date();
    const dates: string[] = [];
    for (let i = range - 1; i >= 0; i -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      dates.push(this.formatLocalDate(day));
    }
    return dates;
  });

  readonly medicationsResource = httpResource<MedicationsResponse>(() => {
    const participantId = this.activeParticipantId();
    this.refreshTick();
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
    const dates = this.rangeDates();
    const startDate = dates[0] ?? this.todayLocalDate();
    const endDate = dates[dates.length - 1] ?? this.todayLocalDate();
    this.refreshTick();
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/medication-logs`,
        method: 'GET',
        params: { startDate, endDate, pageSize: '1' }
      };
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/medication-logs`,
      method: 'GET',
      params: { startDate, endDate, pageSize: '500' }
    };
  });

  readonly medications = computed(() =>
    this.medicationsResource.hasValue() ? this.medicationsResource.value().items : []
  );

  readonly logs = computed(() => (this.logsResource.hasValue() ? this.logsResource.value().items : []));

  readonly activeMedicationsForToday = computed(() => {
    const date = this.todayLocalDate();
    return this.medications()
      .filter((item) => !item.archivedAtUtc)
      .filter((item) => item.startDateUtc <= date)
      .filter((item) => !item.endDateUtc || item.endDateUtc >= date);
  });

  private readonly logMap = computed(() => {
    const map = new Map<string, MedicationLog>();
    for (const log of this.logs()) {
      map.set(this.logKey(log.medicationId, log.logLocalDate), log);
    }
    return map;
  });

  readonly statusesByMedicationId = computed(() => {
    const map = new Map<string, Record<string, 'taken' | 'not_taken'>>();
    for (const log of this.logs()) {
      let statuses = map.get(log.medicationId);
      if (!statuses) {
        statuses = {};
        map.set(log.medicationId, statuses);
      }
      statuses[log.logLocalDate] = log.status;
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

  frequencyLabel(value: string) {
    return this.frequencyLabelMap[value] ?? value;
  }

  logStatus(medicationId: string, logLocalDate: string) {
    return this.logMap().get(this.logKey(medicationId, logLocalDate))?.status ?? null;
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

  markMedication(medication: Medication, status: 'taken' | 'not_taken') {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return;
    }

    this.saveError.set(null);
    this.setSaving(medication.id, true);

    const logDate = this.todayLocalDate();
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
          this.saveError.set('Unable to save medication log. Please try again.');
        }
      });
  }

  isSaving(medicationId: string) {
    return !!this.savingMap()[medicationId];
  }

  private setSaving(medicationId: string, value: boolean) {
    this.savingMap.update((current) => ({ ...current, [medicationId]: value }));
  }

  private logKey(medicationId: string, logLocalDate: string) {
    return `${medicationId}_${logLocalDate}`;
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
