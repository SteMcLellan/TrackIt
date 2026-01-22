import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card.component';
import { ParticipantService } from '../../shared/services/participant.service';
import { MedicationService } from '../../shared/services/medication.service';
import { MedicationLogService } from '../../shared/services/medication-log.service';
import { Medication } from '../../shared/models/medication';
import { MedicationLog } from '../../shared/models/medication-log';
import { CollectionResponse } from '../../shared/models/collection';
import { MedicationDotsStripComponent } from './medication-dots-strip.component';
import { environment } from '../../../environments/environment';

type MedicationsResponse = CollectionResponse<Medication>;
type MedicationLogsResponse = CollectionResponse<MedicationLog>;

type RangeOption = {
  value: number;
  label: string;
};

@Component({
  selector: 'app-medication-adherence',
  imports: [CardComponent, RouterLink, MedicationDotsStripComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <app-card class="card">
        <div class="header">
          <h2>Adherence history</h2>
          <div class="header-links">
            <a class="manage-link" routerLink="/medications">
              Daily log
              <svg class="link-arrow" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </a>
            <span class="link-sep">·</span>
            <a class="manage-link" routerLink="/medications/list">
              Medication list
              <svg class="link-arrow" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </a>
          </div>
          <p class="muted">Review recent medication adherence by day.</p>
        </div>

        @if (!activeParticipantId()) {
          <p class="error" role="alert">Select a participant to view adherence.</p>
          <a class="select-link" routerLink="/participants">Select participant →</a>
        } @else {
          <div class="filters">
            <div class="range">
              @for (option of rangeOptions; track option.value) {
                <button
                  type="button"
                  class="range-button"
                  [class.active]="rangeDays() === option.value"
                  (click)="setRange(option.value)"
                >
                  {{ option.label }}
                </button>
              }
            </div>
            <label class="toggle">
              <input type="checkbox" [checked]="includeArchived()" (change)="toggleArchived($event)" />
              <span>Show archived</span>
            </label>
          </div>
        }
      </app-card>

      <app-card class="card">
        <div class="header">
          <h2>Medication summary</h2>
          <p class="muted">Dots represent each day in the selected range.</p>
        </div>

        @if (!activeParticipantId()) {
          <p class="error" role="alert">Select a participant to view adherence.</p>
        } @else if (medicationsResource.isLoading() || logsResource.isLoading()) {
          <p class="muted">Loading adherence...</p>
        } @else if (medicationsResource.error() || logsResource.error()) {
          <p class="error" role="alert">Unable to load adherence history.</p>
        } @else if (visibleMedications().length === 0) {
          <p class="muted">No medications to display.</p>
          <a class="add-button" routerLink="/medications/list">Add medication</a>
        } @else {
          <div class="dots-header" aria-hidden="true" [style.--dot-count]="rangeDates().length">
            <span>{{ dotsHeader().left }}</span>
            <span>{{ dotsHeader().right }}</span>
          </div>
          <ul class="list" role="list">
            @for (medication of visibleMedications(); track medication.id) {
              <li class="item">
                <div class="item-main">
                  <div class="title">{{ medication.name }}</div>
                  <div class="meta">
                    <span>{{ medication.dosageText }}</span>
                    <span class="dot">·</span>
                    <span>{{ frequencyLabel(medication.frequencyText) }}</span>
                  </div>
                </div>
                <app-medication-dots-strip
                  [dates]="rangeDates()"
                  [statusesByDate]="statusByDate(medication.id)"
                  [startDateUtc]="medication.startDateUtc"
                  [endDateUtc]="medication.endDateUtc"
                />
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
        display: grid;
        gap: var(--space-1, 0.25rem);
        margin-bottom: var(--space-3, 0.75rem);
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
        font-size: var(--font-size-sm, 0.8125rem);
      }
      .add-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
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
        display: flex;
        align-items: center;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
      }
      .range {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2, 0.5rem);
        padding: 0.25rem;
        background: #f1f5f9;
        border-radius: 999px;
      }
      .range-button {
        border: none;
        background: transparent;
        padding: 0.4rem 0.9rem;
        border-radius: 999px;
        font-weight: 600;
        cursor: pointer;
        color: #0f172a;
      }
      .range-button.active {
        background: #0c4a6e;
        color: #fff;
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
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
        min-width: 180px;
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
      .dots-header {
        display: none;
        width: calc(var(--dot-count) * 0.75rem + (var(--dot-count) - 1) * 0.35rem);
        margin: 0 0 var(--space-2, 0.5rem) auto;
        justify-content: space-between;
        gap: 0.5rem;
        color: var(--color-text-muted, #64748b);
        font-size: 0.85rem;
        font-weight: 600;
      }
      @media (min-width: 720px) {
        .dots-header {
          display: flex;
        }
      }
      .strip {
        display: grid;
        grid-auto-flow: column;
        gap: 0.35rem;
        align-items: center;
        justify-content: start;
      }
      .day {
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 999px;
        background: #e2e8f0;
        border: 1px solid transparent;
      }
      .day.taken {
        background: #22c55e;
        border-color: #16a34a;
      }
      .day.not-taken {
        background: #fff;
        border-color: #ef4444;
        position: relative;
      }
      .day.not-taken::after {
        content: '';
        position: absolute;
        width: 120%;
        height: 2px;
        background: #ef4444;
        top: 50%;
        left: -10%;
        transform: rotate(-35deg);
      }
      .day.not-logged {
        background: #f1f5f9;
        border-color: #cbd5f5;
      }
      .dot {
        color: var(--color-text-muted, #94a3b8);
      }
      .error {
        margin: 0;
        color: #b91c1c;
        font-weight: 600;
      }
    `
  ]
})
export class MedicationAdherenceComponent {
  private readonly participants = inject(ParticipantService);
  private readonly medicationsApi = inject(MedicationService);
  private readonly logsApi = inject(MedicationLogService);

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly includeArchived = signal(false);
  readonly rangeDays = signal(7);

  readonly rangeOptions: RangeOption[] = [
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' }
  ];

  readonly medicationsResource = httpResource<MedicationsResponse>(() => {
    const participantId = this.activeParticipantId();
    const includeArchived = this.includeArchived();
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/medications`,
        method: 'GET',
        params: { pageSize: '1' }
      };
    }
    const params: Record<string, string> = { pageSize: '200' };
    if (includeArchived) {
      params['includeArchived'] = 'true';
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/medications`,
      method: 'GET',
      params
    };
  });

  readonly logsResource = httpResource<MedicationLogsResponse>(() => {
    const participantId = this.activeParticipantId();
    const range = this.rangeDays();
    const dates = this.buildRangeDates(range);
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/medication-logs`,
        method: 'GET',
        params: { startDate: dates.start, endDate: dates.end, pageSize: '1' }
      };
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/medication-logs`,
      method: 'GET',
      params: { startDate: dates.start, endDate: dates.end, pageSize: '500' }
    };
  });

  readonly medications = computed(() =>
    this.medicationsResource.hasValue() ? this.medicationsResource.value().items : []
  );

  readonly logs = computed(() => (this.logsResource.hasValue() ? this.logsResource.value().items : []));

  readonly visibleMedications = computed(() =>
    this.includeArchived() ? this.medications() : this.medications().filter((item) => !item.archivedAtUtc)
  );

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

  readonly dotsHeader = computed(() => {
    const dates = this.rangeDates();
    const first = dates[0];
    const last = dates[dates.length - 1];
    return {
      left: first ? this.formatShortDate(first) : '',
      right: last && last === this.todayLocalDate() ? 'Today' : last ? this.formatShortDate(last) : 'Today'
    };
  });

  private readonly logMap = computed(() => {
    const map = new Map<string, MedicationLog>();
    for (const log of this.logs()) {
      map.set(this.logKey(log.medicationId, log.logLocalDate), log);
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

  setRange(value: number) {
    this.rangeDays.set(value);
  }

  toggleArchived(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.includeArchived.set(!!target?.checked);
  }

  logStatus(medicationId: string, logLocalDate: string) {
    return this.logMap().get(this.logKey(medicationId, logLocalDate))?.status ?? null;
  }

  statusByDate(medicationId: string): Record<string, 'taken' | 'not_taken'> {
    const statuses: Record<string, 'taken' | 'not_taken'> = {};
    for (const day of this.rangeDates()) {
      const status = this.logStatus(medicationId, day);
      if (status) {
        statuses[day] = status;
      }
    }
    return statuses;
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

  private buildRangeDates(range: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (range - 1));
    return { start: this.formatLocalDate(start), end: this.formatLocalDate(end) };
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

  private todayLocalDate(): string {
    return this.formatLocalDate(new Date());
  }

  private formatShortDate(value: string): string {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
  }
}
