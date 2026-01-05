import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CardComponent } from '../../shared/ui/card/card.component';
import { FunctionAttentionIconComponent } from '../../shared/ui/icons/function-attention-icon.component';
import { FunctionEscapeIconComponent } from '../../shared/ui/icons/function-escape-icon.component';
import { FunctionSensoryIconComponent } from '../../shared/ui/icons/function-sensory-icon.component';
import { FunctionTangibleIconComponent } from '../../shared/ui/icons/function-tangible-icon.component';
import { BehaviorIncident, BehaviorFunction } from '../../shared/models/behavior-incident';
import { ParticipantService } from '../../shared/services/participant.service';
import { environment } from '../../../environments/environment';

type IncidentsResponse = {
  items: BehaviorIncident[];
  nextToken: string | null;
};

const functionLabels: Record<BehaviorFunction, string> = {
  sensory: 'Automatically Rewarding (Sensory)',
  tangible: 'Get What They Want',
  escape: 'Avoid',
  attention: 'Attention'
};

@Component({
  selector: 'app-incident-list',
  imports: [
    RouterLink,
    CardComponent,
    ReactiveFormsModule,
    FunctionAttentionIconComponent,
    FunctionEscapeIconComponent,
    FunctionSensoryIconComponent,
    FunctionTangibleIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card class="card">
      <div class="header">
        <div>
          <h2>Incidents</h2>
          <p class="muted">Review behavior incidents for the active participant.</p>
        </div>
        <a class="button" routerLink="/incidents/new">Log incident</a>
      </div>

      @if (!activeParticipantId()) {
        <p class="error" role="alert">Select a participant to view incidents.</p>
        <a class="button secondary" routerLink="/participants">Select participant</a>
      } @else if (incidentsResource.isLoading()) {
        <p class="muted">Loading incidents...</p>
      } @else if (incidentsResource.error()) {
        <p class="error" role="alert">Unable to load incidents.</p>
      } @else {
        <form class="filters" [formGroup]="filters">
          <div class="filter">
            <label for="timeRange">Time range</label>
            <select id="timeRange" formControlName="timeRange">
              <option value="all">All time</option>
              <option value="this-week">This week</option>
              <option value="last-week">Last week</option>
              <option value="this-month">This month</option>
              <option value="last-month">Last month</option>
              <option value="last-3-months">Last 3 months</option>
            </select>
          </div>
          <div class="filter">
            <label for="function">Function</label>
            <select id="function" formControlName="function">
              <option value="all">All</option>
              @for (option of functionOptions; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </div>
          <button type="button" class="link reset" (click)="resetFilters()">Clear filters</button>
        </form>

        @if (incidents().length === 0) {
          <div class="empty">
            @if (hasAnyIncidents()) {
              <p class="muted">No incidents match these filters.</p>
            } @else {
              <p class="muted">No incidents yet. Log the first one to get started.</p>
              <a class="button" routerLink="/incidents/new">Log incident</a>
            }
          </div>
        } @else {
          <ul class="list" role="list">
            @for (incident of incidents(); track incident.id) {
              <li class="item">
              <div class="summary">
                <div class="summary-top">
                  <div class="title">{{ formatDate(incident.occurredAtUtc) }}</div>
                  <a
                    class="detail-link"
                    [routerLink]="['/incidents', incident.id]"
                    [queryParams]="{ edit: true }"
                  >
                    <span>Edit</span>
                  </a>
                </div>
                <div class="meta">
                  <span class="function">
                    <span class="icon" aria-hidden="true">
                      @switch (incident.function) {
                          @case ('sensory') { <app-icon-function-sensory /> }
                          @case ('tangible') { <app-icon-function-tangible /> }
                          @case ('escape') { <app-icon-function-escape /> }
                          @case ('attention') { <app-icon-function-attention /> }
                        }
                      </span>
                      <span>{{ functionLabels[incident.function] }}</span>
                    </span>
                    <span class="dot">·</span>
                    <span>{{ incident.place }}</span>
                  </div>
                </div>
              <div class="abc">
                <div class="preview">
                  <span class="tag">A</span>
                  <span>{{ incident.antecedent }}</span>
                </div>
                  <div class="preview">
                    <span class="tag">B</span>
                    <span>{{ incident.behavior }}</span>
                  </div>
                  <div class="preview">
                    <span class="tag">C</span>
                    <span>{{ incident.consequence }}</span>
                  </div>
                </div>
              </li>
            }
          </ul>
        }
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
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
        margin-bottom: var(--space-4, 1rem);
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
      }
      .button.secondary {
        background: #fff;
        color: var(--color-primary, #0c4a6e);
        border: 1px solid var(--color-primary, #0c4a6e);
      }
      .error {
        margin: 0 0 var(--space-3, 0.75rem);
        color: #b91c1c;
        font-weight: 600;
      }
      .empty {
        display: grid;
        gap: var(--space-2, 0.5rem);
      }
      .filters {
        display: grid;
        gap: var(--space-3, 0.75rem);
        margin-bottom: var(--space-4, 1rem);
      }
      .filter label {
        display: block;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }
      .filter input,
      .filter select {
        width: 100%;
        padding: 0.5rem 0.6rem;
        border-radius: var(--radius-2, 0.5rem);
        border: 1px solid #cbd5f5;
        font-family: inherit;
      }
      .reset {
        align-self: flex-start;
      }
      .link {
        background: none;
        border: none;
        color: var(--color-primary, #0c4a6e);
        font-weight: 600;
        cursor: pointer;
        padding: 0;
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
      }
      .summary {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        margin-bottom: var(--space-2, 0.5rem);
      }
      .summary-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2, 0.5rem);
        flex-wrap: wrap;
      }
      .title {
        font-weight: 600;
      }
      .meta {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--color-text-muted, #64748b);
      }
      .detail-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem 0.7rem;
        border-radius: 999px;
        border: 1px solid var(--color-primary, #0c4a6e);
        color: var(--color-primary, #0c4a6e);
        font-weight: 600;
        text-decoration: none;
        white-space: nowrap;
      }
      .function {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-weight: 600;
        color: #1f2937;
      }
      .icon {
        display: inline-flex;
        color: var(--color-primary, #0c4a6e);
      }
      .dot {
        color: var(--color-text-muted, #94a3b8);
      }
      .preview {
        color: #1f2937;
        display: flex;
        gap: var(--space-2, 0.5rem);
        align-items: flex-start;
      }
      .abc {
        display: grid;
        gap: 0.5rem;
      }
      .tag {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.4rem;
        height: 1.4rem;
        border-radius: 999px;
        background: rgba(12, 74, 110, 0.12);
        color: var(--color-primary, #0c4a6e);
        font-weight: 700;
        font-size: 0.8rem;
        flex: 0 0 auto;
      }
      @media (min-width: 900px) {
        .filters {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          align-items: end;
        }
        .reset {
          grid-column: 1 / -1;
        }
      }
    `
  ]
})
export class IncidentListComponent {
  private readonly participants = inject(ParticipantService);
  private readonly fb = inject(FormBuilder);

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly filters = this.fb.group({
    timeRange: this.fb.nonNullable.control('all'),
    fromUtc: this.fb.nonNullable.control(''),
    toUtc: this.fb.nonNullable.control(''),
    function: this.fb.nonNullable.control('all')
  });

  readonly filterSnapshot = signal(this.filters.getRawValue());

  constructor() {
    this.filters.valueChanges.subscribe((value) => {
      this.filterSnapshot.set({
        timeRange: value.timeRange ?? 'all',
        fromUtc: value.fromUtc ?? '',
        toUtc: value.toUtc ?? '',
        function: value.function ?? 'all'
      });
    });
  }

  readonly incidentsResource = httpResource<IncidentsResponse>(() => {
    const participantId = this.activeParticipantId();
    const filters = this.filterSnapshot();
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/incidents`,
        method: 'GET',
        params: { pageSize: '50' }
      };
    }

    const params: Record<string, string> = { pageSize: '50' };
    if (filters.timeRange !== 'all') {
      const range = this.buildRange(filters.timeRange);
      params['fromUtc'] = range.fromUtc;
      params['toUtc'] = range.toUtc;
    }

    if (filters.function !== 'all') {
      params['function'] = filters.function;
    }

    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/incidents`,
      method: 'GET',
      params
    };
  });

  readonly baseIncidentsResource = httpResource<IncidentsResponse>(() => {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/incidents`,
        method: 'GET',
        params: { pageSize: '1' }
      };
    }

    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/incidents`,
      method: 'GET',
      params: { pageSize: '1' }
    };
  });

  readonly incidents = computed(() =>
    this.incidentsResource.hasValue() ? this.incidentsResource.value().items : []
  );

  readonly hasAnyIncidents = computed(() =>
    this.baseIncidentsResource.hasValue() && this.baseIncidentsResource.value().items.length > 0
  );

  readonly functionLabels = functionLabels;
  readonly functionOptions = [
    { value: 'sensory', label: 'Automatically Rewarding (Sensory)' },
    { value: 'tangible', label: 'Get What They Want' },
    { value: 'escape', label: 'Avoid' },
    { value: 'attention', label: 'Attention' }
  ] satisfies Array<{ value: BehaviorFunction; label: string }>;

  formatDate(value: string): string {
    const parsed = new Date(value);
    return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  resetFilters() {
    this.filters.reset({
      timeRange: 'all',
      fromUtc: '',
      toUtc: '',
      function: 'all'
    });
  }

  private buildRange(range: string) {
    const now = new Date();
    const nowUtc = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds()
    ));

    const startOfUtcWeek = (date: Date) => {
      const day = date.getUTCDay();
      const diff = (day + 6) % 7; // Monday = 0
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff));
    };

    const startOfUtcMonth = (date: Date) =>
      new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

    const endOfUtcDay = (date: Date) =>
      new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

    let fromUtc = nowUtc;
    let toUtc = nowUtc;

    switch (range) {
      case 'this-week': {
        fromUtc = startOfUtcWeek(nowUtc);
        toUtc = nowUtc;
        break;
      }
      case 'last-week': {
        const startThisWeek = startOfUtcWeek(nowUtc);
        const endLastWeek = new Date(startThisWeek.getTime() - 1);
        fromUtc = startOfUtcWeek(new Date(startThisWeek.getTime() - 7 * 24 * 60 * 60 * 1000));
        toUtc = endOfUtcDay(endLastWeek);
        break;
      }
      case 'this-month': {
        fromUtc = startOfUtcMonth(nowUtc);
        toUtc = nowUtc;
        break;
      }
      case 'last-month': {
        const startThisMonth = startOfUtcMonth(nowUtc);
        const endLastMonth = new Date(startThisMonth.getTime() - 1);
        fromUtc = startOfUtcMonth(new Date(startThisMonth.getTime() - 1));
        toUtc = endOfUtcDay(endLastMonth);
        break;
      }
      case 'last-3-months': {
        const from = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() - 2, 1));
        fromUtc = from;
        toUtc = nowUtc;
        break;
      }
      default: {
        fromUtc = nowUtc;
        toUtc = nowUtc;
      }
    }

    return { fromUtc: fromUtc.toISOString(), toUtc: toUtc.toISOString() };
  }
}

