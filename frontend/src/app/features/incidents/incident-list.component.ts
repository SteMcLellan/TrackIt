import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CardComponent } from '../../shared/ui/card/card.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
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
    SkeletonComponent,
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
        <h2>Incidents</h2>
        <p class="muted">Review behavior incidents for the active participant.</p>
      </div>

      @if (!activeParticipantId()) {
        <p class="error" role="alert">Select a participant to view incidents.</p>
        <a class="select-link" routerLink="/participants">Select participant →</a>
      } @else if (incidentsResource.isLoading()) {
        <ul class="list" role="list" aria-label="Loading incidents">
          @for (i of [1, 2, 3]; track i) {
            <li class="item skeleton-item">
              <div class="summary">
                <div class="summary-top">
                  <app-skeleton width="140px" height="1rem" />
                  <app-skeleton width="50px" height="28px" radius="999px" />
                </div>
                <div class="meta-skeleton">
                  <app-skeleton width="100px" height="0.9rem" />
                  <app-skeleton width="60px" height="0.9rem" />
                </div>
              </div>
              <div class="abc">
                <div class="preview-skeleton">
                  <app-skeleton variant="circle" width="22px" height="22px" />
                  <app-skeleton width="90%" height="0.9rem" />
                </div>
                <div class="preview-skeleton">
                  <app-skeleton variant="circle" width="22px" height="22px" />
                  <app-skeleton width="85%" height="0.9rem" />
                </div>
                <div class="preview-skeleton">
                  <app-skeleton variant="circle" width="22px" height="22px" />
                  <app-skeleton width="80%" height="0.9rem" />
                </div>
              </div>
            </li>
          }
        </ul>
      } @else if (incidentsResource.error()) {
        <p class="error" role="alert">Unable to load incidents.</p>
      } @else {
        <div class="toolbar">
          <a class="log-button" routerLink="/incidents/new">
            <svg class="log-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            Log incident
          </a>
        </div>
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
          <button type="button" class="clear-link" (click)="resetFilters()">Clear filters</button>
        </form>

        @if (incidents().length === 0) {
          <div class="empty">
            @if (hasAnyIncidents()) {
              <p class="muted">No incidents match these filters.</p>
            } @else {
              <p class="muted">No incidents yet. Log the first one to get started.</p>
              <a class="log-button" routerLink="/incidents/new">
                <svg class="log-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
                Log incident
              </a>
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
        display: grid;
        gap: var(--space-1, 0.25rem);
        margin-bottom: var(--space-4, 1rem);
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
      .toolbar {
        margin-bottom: var(--space-4, 1rem);
      }
      .log-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        background: var(--color-primary, #0c4a6e);
        color: #fff;
        padding: 0.6rem 1rem;
        border-radius: var(--radius-full, 999px);
        text-decoration: none;
        font-weight: 600;
        font-size: var(--font-size-sm, 0.8125rem);
        transition: transform var(--transition-fast, 120ms ease), box-shadow var(--transition-fast, 120ms ease);
      }
      .log-button:hover {
        box-shadow: 0 2px 8px rgba(12, 74, 110, 0.25);
      }
      .log-button:active {
        transform: scale(0.97);
      }
      .log-icon {
        width: 16px;
        height: 16px;
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
      .clear-link {
        align-self: flex-start;
        background: none;
        border: none;
        color: var(--color-text-muted, #64748b);
        font-weight: 500;
        font-size: var(--font-size-sm, 0.8125rem);
        cursor: pointer;
        padding: 0;
        transition: color var(--transition-fast, 120ms ease);
      }
      .clear-link:hover {
        color: var(--color-primary, #0c4a6e);
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
      .meta-skeleton {
        display: flex;
        gap: var(--space-2, 0.5rem);
      }
      .preview-skeleton {
        display: flex;
        gap: var(--space-2, 0.5rem);
        align-items: center;
      }
      .skeleton-item {
        padding: var(--space-4, 1rem);
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
        .clear-link {
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
    startDate: this.fb.nonNullable.control(''),
    endDate: this.fb.nonNullable.control(''),
    function: this.fb.nonNullable.control('all')
  });

  readonly filterSnapshot = signal(this.filters.getRawValue());

  constructor() {
    this.filters.valueChanges.subscribe((value) => {
      this.filterSnapshot.set({
        timeRange: value.timeRange ?? 'all',
        startDate: value.startDate ?? '',
        endDate: value.endDate ?? '',
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
      const range = this.buildLocalDateRange(filters.timeRange);
      params['startDate'] = range.startDate;
      params['endDate'] = range.endDate;
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
      startDate: '',
      endDate: '',
      function: 'all'
    });
  }

  private buildLocalDateRange(range: string): { startDate: string; endDate: string } {
    const now = new Date();
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startOfWeek = (date: Date): Date => {
      const day = date.getDay();
      const diff = (day + 6) % 7; // Monday = 0
      const result = new Date(date);
      result.setDate(date.getDate() - diff);
      return result;
    };

    const startOfMonth = (date: Date): Date => {
      return new Date(date.getFullYear(), date.getMonth(), 1);
    };

    const endOfDay = (date: Date): Date => {
      const result = new Date(date);
      result.setHours(23, 59, 59, 999);
      return result;
    };

    let startDate = now;
    let endDate = now;

    switch (range) {
      case 'this-week': {
        startDate = startOfWeek(now);
        endDate = now;
        break;
      }
      case 'last-week': {
        const startThisWeek = startOfWeek(now);
        const endLastWeek = new Date(startThisWeek);
        endLastWeek.setDate(startThisWeek.getDate() - 1);
        const startLastWeek = new Date(startThisWeek);
        startLastWeek.setDate(startThisWeek.getDate() - 7);
        startDate = startLastWeek;
        endDate = endOfDay(endLastWeek);
        break;
      }
      case 'this-month': {
        startDate = startOfMonth(now);
        endDate = now;
        break;
      }
      case 'last-month': {
        const startThisMonth = startOfMonth(now);
        const endLastMonth = new Date(startThisMonth);
        endLastMonth.setDate(startThisMonth.getDate() - 1);
        const startLastMonth = startOfMonth(new Date(startThisMonth.getTime() - 1));
        startDate = startLastMonth;
        endDate = endOfDay(endLastMonth);
        break;
      }
      case 'last-3-months': {
        const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        startDate = from;
        endDate = now;
        break;
      }
      default: {
        startDate = now;
        endDate = now;
      }
    }

    return { startDate: formatDate(startDate), endDate: formatDate(endDate) };
  }
}

