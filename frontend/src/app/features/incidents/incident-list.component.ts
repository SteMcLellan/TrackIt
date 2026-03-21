import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ParticipantService } from '../../shared/services/participant.service';
import { BehaviorIncidentService } from '../../shared/services/behavior-incident.service';
import { BehaviorFunction, BehaviorIncident } from '../../shared/models/behavior-incident';

type FunctionFilter = BehaviorFunction | 'all';

const FUNCTION_LABELS: Record<BehaviorFunction, string> = {
  sensory: 'Sensory',
  tangible: 'Tangible',
  escape: 'Escape',
  attention: 'Attention'
};

const FILTER_OPTIONS: { value: FunctionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sensory', label: 'Sensory' },
  { value: 'tangible', label: 'Tangible' },
  { value: 'escape', label: 'Escape' },
  { value: 'attention', label: 'Attention' }
];

function todayLocalDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function subtractDays(dateStr: string, days: number): string {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDisplayDate(logLocalDate: string, logLocalTime: string): string {
  const parts = logLocalDate.split('-').map(Number);
  const timeParts = logLocalTime.split(':').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1]);
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

@Component({
  selector: 'app-incident-list',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <section class="hero">
        <h1>Incidents</h1>
        <p class="muted">Browse and manage logged behavioral incidents.</p>
      </section>

      <div class="log-action">
        <a class="button" routerLink="/incidents/new">
          <span class="material-symbols-outlined">add</span>
          Log Incident
        </a>
      </div>

      <section class="filters-card">
        <div class="date-row">
          <div class="date-field">
            <label for="startDate">From</label>
            <input
              id="startDate"
              type="date"
              [value]="startDate()"
              (change)="onStartDateChange($event)"
            />
          </div>
          <div class="date-field">
            <label for="endDate">To</label>
            <input
              id="endDate"
              type="date"
              [value]="endDate()"
              (change)="onEndDateChange($event)"
            />
          </div>
        </div>
        <div class="function-filters" role="group" aria-label="Filter by function">
          @for (opt of filterOptions; track opt.value) {
            <button
              type="button"
              class="filter-chip"
              [class.active]="functionFilter() === opt.value"
              (click)="setFunctionFilter(opt.value)"
            >{{ opt.label }}</button>
          }
        </div>
      </section>

      @if (loading()) {
        <p class="status-text">Loading incidents…</p>
      } @else if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      } @else if (incidents().length === 0) {
        <section class="empty-card">
          <p class="empty-text">No incidents found for this date range.</p>
          <a class="button" routerLink="/incidents/new">Log an incident</a>
        </section>
      } @else {
        <ul class="incident-list" role="list">
          @for (incident of incidents(); track incident.id) {
            <li>
              <a class="incident-row" [routerLink]="['/incidents', incident.id]">
                <div class="incident-meta">
                  <span class="incident-date">{{ formatDate(incident.logLocalDate, incident.logLocalTime) }}</span>
                  <span class="function-badge" [attr.data-fn]="incident.function">{{ functionLabel(incident.function) }}</span>
                </div>
                <p class="incident-summary">
                  <span class="abc-label">A:</span> {{ truncateText(incident.antecedent) }}
                </p>
                <p class="incident-summary">
                  <span class="abc-label">B:</span> {{ truncateText(incident.behavior) }}
                </p>
                <p class="incident-summary">
                  <span class="abc-label">C:</span> {{ truncateText(incident.consequence) }}
                </p>
                <span class="material-symbols-outlined chevron">chevron_right</span>
              </a>
            </li>
          }
        </ul>

        @if (nextToken()) {
          <button
            type="button"
            class="load-more"
            [disabled]="loadingMore()"
            (click)="loadMore()"
          >{{ loadingMore() ? 'Loading…' : 'Load more' }}</button>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-width: 100%;
    }

    .page {
      width: 100%;
      max-width: 28rem;
      margin: 0 auto;
      padding: 1.5rem 1.25rem 7.5rem;
      box-sizing: border-box;
      overflow-x: hidden;
    }

    .hero {
      margin-bottom: 1rem;
    }

    h1 {
      margin: 0;
      font-size: 1.625rem;
      line-height: 1.2;
      letter-spacing: -0.01em;
      color: var(--color-midnight-slate, #1e293b);
    }

    .muted {
      margin: 0.375rem 0 0;
      color: var(--color-text-muted, #64748b);
      font-size: 0.875rem;
    }

    .log-action {
      margin-bottom: 1rem;
    }

    .button {
      min-height: 44px;
      border: 0;
      border-radius: 999px;
      padding: 0.625rem 1rem;
      font-weight: 700;
      font-size: 0.875rem;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      background: var(--color-electric-violet, #8b5cf6);
      color: #ffffff;
      cursor: pointer;
    }

    .button .material-symbols-outlined {
      font-size: 1.125rem;
    }

    .filters-card {
      border-radius: 0.875rem;
      padding: 1rem;
      margin-bottom: 1rem;
      border: 1px solid #f1f5f9;
      background: #ffffff;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
    }

    .date-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .date-field label {
      display: block;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      margin-bottom: 0.375rem;
    }

    .date-field input {
      width: 100%;
      min-height: 44px;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 0.5rem 0.75rem;
      box-sizing: border-box;
      font: inherit;
      font-size: 0.875rem;
      background: #fff;
    }

    .function-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .filter-chip {
      min-height: 36px;
      border-radius: 999px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: var(--color-midnight-slate, #1e293b);
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 0.375rem 0.875rem;
      cursor: pointer;
    }

    .filter-chip.active {
      background: var(--color-electric-violet, #8b5cf6);
      border-color: var(--color-electric-violet, #8b5cf6);
      color: #ffffff;
    }

    .status-text {
      text-align: center;
      color: var(--color-text-muted, #64748b);
      font-size: 0.875rem;
      margin: 2rem 0;
    }

    .error {
      margin: 0 0 1rem;
      color: #b91c1c;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .empty-card {
      border-radius: 0.875rem;
      padding: 2rem 1rem;
      text-align: center;
      border: 1px solid #f1f5f9;
      background: #ffffff;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
    }

    .empty-text {
      margin: 0 0 1rem;
      color: var(--color-text-muted, #64748b);
      font-size: 0.875rem;
    }

    .incident-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .incident-row {
      display: block;
      position: relative;
      border-radius: 0.875rem;
      padding: 1rem 2.5rem 1rem 1rem;
      border: 1px solid #f1f5f9;
      background: #ffffff;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
      text-decoration: none;
      color: inherit;
    }

    .incident-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      flex-wrap: wrap;
    }

    .incident-date {
      font-size: 0.75rem;
      color: var(--color-text-muted, #64748b);
      font-weight: 600;
    }

    .function-badge {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 999px;
      padding: 0.125rem 0.5rem;
      background: var(--color-soft-violet, #f5f3ff);
      color: var(--color-electric-violet, #8b5cf6);
    }

    .function-badge[data-fn="tangible"] {
      background: var(--color-soft-amber, #fffbeb);
      color: var(--color-energetic-amber, #f59e0b);
    }

    .function-badge[data-fn="escape"] {
      background: var(--color-soft-emerald, #ecfdf5);
      color: var(--color-vital-emerald, #10b981);
    }

    .function-badge[data-fn="attention"] {
      background: var(--color-soft-azure, #f0f9ff);
      color: var(--color-sky-azure, #0ea5e9);
    }

    .incident-summary {
      margin: 0.25rem 0 0;
      font-size: 0.8125rem;
      color: var(--color-midnight-slate, #1e293b);
      line-height: 1.4;
    }

    .abc-label {
      font-weight: 700;
      color: var(--color-text-muted, #64748b);
    }

    .chevron {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1.25rem;
      color: #94a3b8;
    }

    .load-more {
      width: 100%;
      min-height: 44px;
      margin-top: 0.75rem;
      border-radius: 999px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: var(--color-midnight-slate, #1e293b);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
    }

    .load-more:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class IncidentListComponent implements OnInit {
  private readonly participantService = inject(ParticipantService);
  private readonly incidentService = inject(BehaviorIncidentService);

  readonly filterOptions = FILTER_OPTIONS;

  readonly startDate = signal(subtractDays(todayLocalDate(), 30));
  readonly endDate = signal(todayLocalDate());
  readonly functionFilter = signal<FunctionFilter>('all');

  readonly incidents = signal<BehaviorIncident[]>([]);
  readonly nextToken = signal<string | null>(null);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  onStartDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.startDate.set(value);
      this.load();
    }
  }

  onEndDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.endDate.set(value);
      this.load();
    }
  }

  setFunctionFilter(value: FunctionFilter): void {
    this.functionFilter.set(value);
    this.load();
  }

  loadMore(): void {
    const token = this.nextToken();
    if (!token || this.loadingMore()) return;

    const participantId = this.participantService.activeParticipantId();
    if (!participantId) return;

    this.loadingMore.set(true);
    const fn = this.functionFilter();

    this.incidentService.listIncidents(participantId, {
      pageSize: 20,
      nextToken: token,
      startDate: this.startDate(),
      endDate: this.endDate(),
      ...(fn !== 'all' ? { function: fn } : {})
    }).subscribe({
      next: (resp) => {
        this.incidents.update(existing => [...existing, ...resp.items]);
        this.nextToken.set(resp.nextToken);
        this.loadingMore.set(false);
      },
      error: () => {
        this.error.set('Unable to load more incidents. Please try again.');
        this.loadingMore.set(false);
      }
    });
  }

  formatDate(logLocalDate: string, logLocalTime: string): string {
    return formatDisplayDate(logLocalDate, logLocalTime);
  }

  functionLabel(fn: BehaviorFunction): string {
    return FUNCTION_LABELS[fn];
  }

  truncateText(text: string): string {
    return truncate(text, 60);
  }

  private load(): void {
    const participantId = this.participantService.activeParticipantId();
    if (!participantId) return;

    this.loading.set(true);
    this.error.set(null);
    this.incidents.set([]);
    this.nextToken.set(null);

    const fn = this.functionFilter();

    this.incidentService.listIncidents(participantId, {
      pageSize: 20,
      startDate: this.startDate(),
      endDate: this.endDate(),
      ...(fn !== 'all' ? { function: fn } : {})
    }).subscribe({
      next: (resp) => {
        this.incidents.set(resp.items);
        this.nextToken.set(resp.nextToken);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load incidents. Please try again.');
        this.loading.set(false);
      }
    });
  }
}
