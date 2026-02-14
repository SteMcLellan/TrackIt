import { httpResource } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageTitleComponent } from '../../shared/ui/page/page-title.component';
import { DateRangeOption, DateRangeSelectorComponent } from '../../shared/ui/filters/date-range-selector.component';
import { CardComponent } from '../../shared/ui/card.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ParticipantService } from '../../shared/services/participant.service';
import { BehaviorIncidentService } from '../../shared/services/behavior-incident.service';
import { MedicationService } from '../../shared/services/medication.service';
import { MedicationLogService } from '../../shared/services/medication-log.service';
import { TimelineEvent, TimelineResponse, TimelineSourceType } from '../../shared/models/timeline-event';
import { BehaviorIncident } from '../../shared/models/behavior-incident';
import { Medication } from '../../shared/models/medication';
import { MedicationLog } from '../../shared/models/medication-log';
import { environment } from '../../../environments/environment';

type DetailRecord = Record<string, BehaviorIncident | Medication | MedicationLog>;
type LoadingRecord = Record<string, boolean>;
type ErrorRecord = Record<string, string>;

const typeLabels: Record<TimelineSourceType, string> = {
  incident: 'Incident',
  medication_log: 'Medication log',
  medication: 'Medication',
  daily_reflection: 'Daily reflection'
};

@Component({
  selector: 'app-timeline-legacy',
  imports: [
    RouterLink,
    DatePipe,
    PageTitleComponent,
    DateRangeSelectorComponent,
    CardComponent,
    SkeletonComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <app-page-title
        title="Timeline"
        subtitle="Interleaved events across incidents, medications, and medication logs."
      />

      <app-date-range-selector
        [selectedRange]="rangeDays()"
        (rangeChanged)="setRange($event)"
      />

      <app-card class="card">
        <div class="type-filters" role="group" aria-label="Timeline type filter">
          @for (option of sourceTypeOptions; track option.value) {
            <button
              type="button"
              class="type-pill"
              [class.active]="typeFilter() === option.value"
              [attr.aria-pressed]="typeFilter() === option.value"
              (click)="setTypeFilter(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>

        @if (!activeParticipantId()) {
          <p class="error" role="alert">Select a participant to view timeline events.</p>
          <a class="select-link" routerLink="/participants">Select participant &rarr;</a>
        } @else if (timelineResource.isLoading()) {
          <ul class="list" role="list" aria-label="Loading timeline">
            @for (i of [1, 2, 3, 4]; track i) {
              <li class="event skeleton-item">
                <app-skeleton width="120px" height="0.8rem" />
                <app-skeleton width="70%" height="1rem" />
              </li>
            }
          </ul>
        } @else if (timelineResource.error()) {
          <p class="error" role="alert">Unable to load timeline.</p>
        } @else if (events().length === 0) {
          <p class="muted">No events in the selected range.</p>
        } @else {
          <ul class="list" role="list">
            @for (event of events(); track event.id) {
              <li class="event">
                <button
                  type="button"
                  class="event-header"
                  (click)="toggleExpanded(event)"
                  [attr.aria-expanded]="expandedEventId() === event.id"
                >
                  <span class="event-time">
                    {{ event.eventAtUtc | date: 'MMM d, h:mm a' }}
                  </span>
                  <span class="event-type">{{ sourceTypeLabel(event.sourceType) }}</span>
                  <span class="event-title">{{ event.summary.title }}</span>
                  @if (event.summary.subtitle) {
                    <span class="event-subtitle">{{ event.summary.subtitle }}</span>
                  }
                </button>

                @if (expandedEventId() === event.id) {
                  <div class="event-detail">
                    @if (isLoadingDetail(event.id)) {
                      <p class="muted">Loading details...</p>
                    } @else if (detailError(event.id)) {
                      <p class="error" role="alert">{{ detailError(event.id) }}</p>
                    } @else {
                      @if (event.sourceType === 'incident' && incidentDetail(event.id)) {
                        <div class="detail-grid">
                          <p><strong>Antecedent:</strong> {{ incidentDetail(event.id)!.antecedent }}</p>
                          <p><strong>Behavior:</strong> {{ incidentDetail(event.id)!.behavior }}</p>
                          <p><strong>Consequence:</strong> {{ incidentDetail(event.id)!.consequence }}</p>
                        </div>
                      } @else if (event.sourceType === 'medication' && medicationDetail(event.id)) {
                        <div class="detail-grid">
                          <p><strong>Name:</strong> {{ medicationDetail(event.id)!.name }}</p>
                          <p><strong>Dosage:</strong> {{ medicationDetail(event.id)!.dosageText }}</p>
                          <p><strong>Frequency:</strong> {{ medicationDetail(event.id)!.frequencyText }}</p>
                        </div>
                      } @else if (event.sourceType === 'medication_log' && medicationLogDetail(event.id)) {
                        <div class="detail-grid">
                          <p><strong>Status:</strong> {{ medicationLogDetail(event.id)!.status }}</p>
                          <p><strong>Date:</strong> {{ medicationLogDetail(event.id)!.logLocalDate }}</p>
                          <p><strong>Occurrence:</strong> {{ medicationLogDetail(event.id)!.occurrenceKey }}</p>
                        </div>
                      } @else {
                        <p class="muted">No additional detail available.</p>
                      }
                    }
                  </div>
                }
              </li>
            }
          </ul>
        }
      </app-card>
    </div>
  `,
  styles: [`
    .layout {
      display: grid;
      gap: var(--space-4, 1rem);
      padding-bottom: var(--space-6, 1.5rem);
    }
    .card {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }
    .type-filters {
      display: flex;
      gap: var(--space-2, 0.5rem);
      flex-wrap: wrap;
      margin-bottom: var(--space-3, 0.75rem);
    }
    .type-pill {
      border: 1px solid #cbd5e1;
      background: #fff;
      border-radius: 999px;
      min-height: 44px;
      padding: 0.4rem 0.75rem;
      font-weight: 600;
      color: #0f172a;
    }
    .type-pill.active {
      border-color: var(--color-primary, #0c4a6e);
      background: rgba(12, 74, 110, 0.1);
      color: var(--color-primary, #0c4a6e);
    }
    .list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: var(--space-2, 0.5rem);
    }
    .event {
      border: 1px solid #e2e8f0;
      border-radius: var(--radius-2, 0.5rem);
      overflow: hidden;
      background: #fff;
    }
    .event-header {
      width: 100%;
      border: none;
      background: #fff;
      display: grid;
      gap: 0.25rem;
      text-align: left;
      padding: var(--space-3, 0.75rem);
      min-height: 44px;
      max-width: 100%;
    }
    .event-time {
      font-size: var(--font-size-sm, 0.8125rem);
      color: var(--color-text-muted, #64748b);
    }
    .event-type {
      display: inline-flex;
      align-self: flex-start;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-primary, #0c4a6e);
      font-weight: 700;
    }
    .event-title {
      font-weight: 700;
      color: #0f172a;
      word-break: break-word;
    }
    .event-subtitle {
      color: #334155;
      font-size: var(--font-size-sm, 0.8125rem);
      word-break: break-word;
    }
    .event-detail {
      border-top: 1px solid #e2e8f0;
      padding: var(--space-3, 0.75rem);
      background: #f8fafc;
    }
    .detail-grid {
      display: grid;
      gap: 0.4rem;
      max-width: 100%;
    }
    .detail-grid p {
      margin: 0;
      word-break: break-word;
    }
    .error {
      margin: 0;
      color: #b91c1c;
      font-weight: 600;
    }
    .muted {
      margin: 0;
      color: var(--color-text-muted, #64748b);
    }
    .select-link {
      display: inline-flex;
      margin-top: var(--space-2, 0.5rem);
      color: var(--color-primary, #0c4a6e);
      text-decoration: none;
      font-weight: 600;
    }
    .skeleton-item {
      padding: var(--space-3, 0.75rem);
      display: grid;
      gap: 0.35rem;
    }
  `]
})
export class TimelineLegacyComponent {
  private readonly participants = inject(ParticipantService);
  private readonly incidents = inject(BehaviorIncidentService);
  private readonly medications = inject(MedicationService);
  private readonly medicationLogs = inject(MedicationLogService);

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly rangeDays = signal<DateRangeOption>(7);
  readonly typeFilter = signal<'all' | TimelineSourceType>('all');
  readonly expandedEventId = signal<string | null>(null);
  readonly details = signal<DetailRecord>({});
  readonly detailLoading = signal<LoadingRecord>({});
  readonly detailErrors = signal<ErrorRecord>({});

  readonly sourceTypeOptions = [
    { value: 'all' as const, label: 'All' },
    { value: 'incident' as const, label: 'Incidents' },
    { value: 'medication_log' as const, label: 'Medication Logs' },
    { value: 'medication' as const, label: 'Medications' },
    { value: 'daily_reflection' as const, label: 'Daily Reflection' }
  ];

  readonly timelineResource = httpResource<TimelineResponse>(() => {
    const participantId = this.activeParticipantId();
    const range = this.rangeDays();
    const filter = this.typeFilter();
    const endUtc = new Date().toISOString();
    const startUtc = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();

    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/timeline`,
        method: 'GET',
        params: { '$startUtc': startUtc, '$endUtc': endUtc, '$top': '1' }
      };
    }

    const params: Record<string, string> = {
      '$startUtc': startUtc,
      '$endUtc': endUtc,
      '$top': '200',
      '$orderBy': 'eventAtUtc desc'
    };
    if (filter !== 'all') {
      params['$types'] = filter;
    }

    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/timeline`,
      method: 'GET',
      params
    };
  });

  readonly events = computed(() => (
    this.timelineResource.hasValue() ? this.timelineResource.value().items : []
  ));

  setRange(range: DateRangeOption): void {
    this.rangeDays.set(range);
  }

  setTypeFilter(value: 'all' | TimelineSourceType): void {
    this.typeFilter.set(value);
  }

  sourceTypeLabel(sourceType: TimelineSourceType): string {
    return typeLabels[sourceType];
  }

  toggleExpanded(event: TimelineEvent): void {
    const current = this.expandedEventId();
    if (current === event.id) {
      this.expandedEventId.set(null);
      return;
    }
    this.expandedEventId.set(event.id);
    this.loadDetails(event);
  }

  isLoadingDetail(eventId: string): boolean {
    return this.detailLoading()[eventId] === true;
  }

  detailError(eventId: string): string | null {
    return this.detailErrors()[eventId] || null;
  }

  incidentDetail(eventId: string): BehaviorIncident | null {
    const detail = this.details()[eventId];
    return detail && 'antecedent' in detail ? detail as BehaviorIncident : null;
  }

  medicationDetail(eventId: string): Medication | null {
    const detail = this.details()[eventId];
    return detail && 'dosageText' in detail ? detail as Medication : null;
  }

  medicationLogDetail(eventId: string): MedicationLog | null {
    const detail = this.details()[eventId];
    return detail && 'occurrenceKey' in detail ? detail as MedicationLog : null;
  }

  private loadDetails(event: TimelineEvent): void {
    if (this.details()[event.id] || this.detailLoading()[event.id]) {
      return;
    }

    const participantId = this.activeParticipantId();
    if (!participantId) {
      return;
    }

    this.detailLoading.update((state) => ({ ...state, [event.id]: true }));
    this.detailErrors.update((state) => ({ ...state, [event.id]: '' }));

    const complete = () => {
      this.detailLoading.update((state) => ({ ...state, [event.id]: false }));
    };

    const handleError = () => {
      this.detailErrors.update((state) => ({ ...state, [event.id]: 'Unable to load event details.' }));
      complete();
    };

    if (event.sourceType === 'incident') {
      this.incidents.getIncident(participantId, event.sourceId).subscribe({
        next: (value) => {
          this.details.update((state) => ({ ...state, [event.id]: value }));
          complete();
        },
        error: handleError
      });
      return;
    }

    if (event.sourceType === 'medication') {
      this.medications.getMedication(participantId, event.sourceId).subscribe({
        next: (value) => {
          this.details.update((state) => ({ ...state, [event.id]: value }));
          complete();
        },
        error: handleError
      });
      return;
    }

    if (event.sourceType !== 'medication_log') {
      complete();
      return;
    }

    this.medicationLogs.getLog(participantId, event.sourceId).subscribe({
      next: (value) => {
        this.details.update((state) => ({ ...state, [event.id]: value }));
        complete();
      },
      error: handleError
    });
  }
}
