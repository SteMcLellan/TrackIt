import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card/card.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
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
  imports: [CardComponent, RouterLink, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <app-card class="card">
        <div class="header">
          <h2>Medication log</h2>
          <div class="header-links">
            <a class="manage-link" routerLink="/medications/history">
              Adherence
              <svg class="link-arrow" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </a>
            <span class="link-sep">&middot;</span>
            <a class="manage-link" routerLink="/medications/list">
              Medication list
              <svg class="link-arrow" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </a>
          </div>
          <p class="muted">Quickly log medications for the active participant.</p>
        </div>

        @if (!activeParticipantId()) {
          <p class="error" role="alert">Select a participant to log medications.</p>
          <a class="select-link" routerLink="/participants">Select participant &rarr;</a>
        } @else {
          <div class="date-picker">
            <div class="quick-dates" role="group" aria-label="Quick date selection">
              @for (day of quickDates(); track day.date) {
                <button
                  type="button"
                  class="date-button"
                  [class.active]="logLocalDate() === day.date && !showCustomPicker()"
                  (click)="selectQuickDate(day.date)"
                >
                  <span class="date-label">{{ day.label }}</span>
                  <span class="date-value">{{ day.shortDate }}</span>
                </button>
              }
              <button
                type="button"
                class="date-button custom"
                [class.active]="showCustomPicker() || isCustomDate()"
                (click)="openCustomPicker()"
              >
                <span class="date-label">Custom</span>
                <span class="date-value">{{ isCustomDate() ? formatShortDate(logLocalDate()) : '...' }}</span>
              </button>
            </div>
            @if (showCustomPicker()) {
              <div class="custom-picker">
                <input
                  id="logDate"
                  type="date"
                  [min]="minLogDate()"
                  [max]="maxLogDate()"
                  [value]="logLocalDate()"
                  (change)="onCustomDateChange($event)"
                />
                <span class="hint">Up to 30 days back</span>
              </div>
            }
          </div>
        }
      </app-card>

      <app-card class="card">
        <div class="header">
          <h2>Daily checklist</h2>
          <p class="muted">Tap to mark medications as taken or skipped.</p>
        </div>

        @if (!activeParticipantId()) {
          <p class="error" role="alert">Select a participant to view the checklist.</p>
        } @else if (medicationsResource.isLoading()) {
          <ul class="list" role="list" aria-label="Loading medications">
            @for (i of [1, 2, 3]; track i) {
              <li class="item skeleton-item">
                <div class="item-main">
                  <app-skeleton width="120px" height="1.1rem" />
                  <div class="meta-skeleton">
                    <app-skeleton width="80px" height="0.9rem" />
                    <app-skeleton width="60px" height="0.9rem" />
                  </div>
                  <app-skeleton width="70px" height="1.5rem" radius="999px" />
                </div>
                <div class="item-actions">
                  <app-skeleton variant="button" width="80px" height="44px" />
                  <app-skeleton variant="button" width="100px" height="44px" />
                </div>
              </li>
            }
          </ul>
        } @else if (medicationsResource.error()) {
          <p class="error" role="alert">Unable to load medications.</p>
        } @else if (activeMedicationsForDate().length === 0) {
          <p class="muted">No active medications for this date.</p>
          <a class="add-button" routerLink="/medications/list">Add medication</a>
        } @else if (logsResource.isLoading()) {
          <ul class="list" role="list" aria-label="Loading log entries">
            @for (i of [1, 2, 3]; track i) {
              <li class="item skeleton-item">
                <div class="item-main">
                  <app-skeleton width="120px" height="1.1rem" />
                  <div class="meta-skeleton">
                    <app-skeleton width="80px" height="0.9rem" />
                    <app-skeleton width="60px" height="0.9rem" />
                  </div>
                  <app-skeleton width="70px" height="1.5rem" radius="999px" />
                </div>
                <div class="item-actions">
                  <app-skeleton variant="button" width="80px" height="44px" />
                  <app-skeleton variant="button" width="100px" height="44px" />
                </div>
              </li>
            }
          </ul>
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
                    <span class="dot">&middot;</span>
                    <span>{{ frequencyLabel(medication.frequencyText) }}</span>
                  </div>
                </div>
                <div class="item-actions">
                  @switch (logStatus(medication.id)) {
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
    </div>
  `,
  styles: [
    `
      .layout {
        display: grid;
        gap: var(--space-5, 1.5rem);
      }
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
      .header-links {
        display: flex;
        align-items: center;
        gap: var(--space-2, 0.5rem);
        flex-wrap: wrap;
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
      .link-sep {
        color: var(--color-text-muted, #94a3b8);
      }
      h2 {
        margin: 0;
        font-size: var(--font-size-lg, 1.125rem);
        font-weight: 600;
      }
      .muted {
        margin: 0;
        color: var(--color-text-muted, #64748b);
      }
      .add-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        background: var(--color-primary, #0c4a6e);
        color: #fff;
        padding: 0.6rem 1rem;
        border-radius: var(--radius-full, 999px);
        text-decoration: none;
        font-weight: 600;
        font-size: var(--font-size-sm, 0.8125rem);
        border: none;
        cursor: pointer;
      }
      .select-link {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        color: var(--color-primary, #0c4a6e);
        text-decoration: none;
        font-weight: 600;
        font-size: var(--font-size-sm, 0.8125rem);
      }
      .filters {
        display: grid;
        gap: var(--space-2, 0.5rem);
        margin-top: var(--space-2, 0.5rem);
      }
      .date-picker {
        display: grid;
        gap: var(--space-3, 0.75rem);
        margin-top: var(--space-2, 0.5rem);
      }
      .quick-dates {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: var(--space-2, 0.5rem);
      }
      .date-button {
        border: 1px solid #e2e8f0;
        background: #fff;
        border-radius: var(--radius-2, 0.5rem);
        padding: 0.65rem 0.75rem;
        text-align: left;
        cursor: pointer;
        display: grid;
        gap: 0.15rem;
        transition: border-color var(--transition-fast, 120ms ease),
                    box-shadow var(--transition-fast, 120ms ease),
                    background var(--transition-fast, 120ms ease);
      }
      .date-button:hover {
        border-color: #cbd5f5;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
      }
      .date-button.active {
        border-color: var(--color-primary, #0c4a6e);
        background: rgba(12, 74, 110, 0.08);
        box-shadow: 0 4px 10px rgba(12, 74, 110, 0.18);
      }
      .date-button.custom {
        border-style: dashed;
      }
      .date-label {
        font-size: var(--font-size-sm, 0.8125rem);
        font-weight: 600;
        color: var(--color-text-muted, #64748b);
      }
      .date-value {
        font-size: 1rem;
        font-weight: 700;
        color: #0f172a;
      }
      .custom-picker {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2, 0.5rem);
        align-items: center;
      }
      .custom-picker input[type='date'] {
        padding: 0.5rem 0.6rem;
        border-radius: var(--radius-2, 0.5rem);
        border: 1px solid #cbd5f5;
        font-family: inherit;
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
        gap: var(--space-4, 1rem);
      }
      .item {
        border: 1px solid #e2e8f0;
        border-radius: var(--radius-2, 0.5rem);
        padding: var(--space-4, 1rem);
        background: #fff;
        display: flex;
        justify-content: space-between;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
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
      .item-actions {
        display: flex;
        gap: 0.75rem;
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
      .dot {
        color: var(--color-text-muted, #94a3b8);
      }
      .meta-skeleton {
        display: flex;
        gap: var(--space-2, 0.5rem);
      }
      .skeleton-item {
        padding: var(--space-4, 1rem);
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
      @media (max-width: 520px) {
        .status-button {
          flex: 1;
          min-width: 0;
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
  readonly showCustomPicker = signal(false);

  readonly quickDates = computed(() => {
    const today = new Date();
    const offsets = [0, 1, 2];
    return offsets.map((offset) => {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      return {
        date: this.formatLocalDate(date),
        label: offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : 'Two days ago',
        shortDate: this.formatShortDate(date)
      };
    });
  });

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

  selectQuickDate(date: string) {
    this.logLocalDate.set(date);
    this.showCustomPicker.set(false);
  }

  openCustomPicker() {
    this.showCustomPicker.set(true);
  }

  onCustomDateChange(event: Event) {
    const target = event.target as HTMLInputElement | null;
    if (!target?.value) {
      return;
    }
    this.logLocalDate.set(target.value);
    this.showCustomPicker.set(false);
  }

  isCustomDate() {
    const current = this.logLocalDate();
    return !this.quickDates().some((day) => day.date === current);
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

  private formatShortDate(date: Date | string): string {
    if (typeof date === 'string') {
      const [year, month, day] = date.split('-').map(Number);
      if (!year || !month || !day) {
        return date;
      }
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
        new Date(year, month - 1, day)
      );
    }
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  }
}
