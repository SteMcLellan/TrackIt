import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorIncident } from '../../shared/models/behavior-incident';
import { CollectionResponse } from '../../shared/models/collection';
import { ParticipantService } from '../../shared/services/participant.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { MedicationCheckinComponent } from '../medications/medication-checkin.component';
import { environment } from '../../../environments/environment';

type IncidentsResponse = CollectionResponse<BehaviorIncident>;

const functionLabels: Record<BehaviorIncident['function'], string> = {
  sensory: 'Sensory',
  tangible: 'Tangible',
  escape: 'Escape',
  attention: 'Attention'
};

type RangeOption = {
  value: 7 | 14 | 30;
  label: string;
};

@Component({
  selector: 'app-home',
  imports: [CardComponent, RouterLink, MedicationCheckinComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <div class="context-bar">
        <span class="context-label">Showing last</span>
        <div class="range-buttons" role="group" aria-label="Date range">
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
      </div>

      <app-medication-checkin [rangeDays]="rangeDays()" />

      <app-card class="card">
        <div class="header">
          <h2>Incidents</h2>
          <a class="manage-link" routerLink="/incidents">
            View all
            <svg class="link-arrow" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </a>
          @if (incidentsCount() > 0) {
            <p class="muted">{{ incidentsCount() }} in the last {{ rangeDays() }} days</p>
          } @else {
            <p class="muted">Last {{ rangeDays() }} days</p>
          }
        </div>

        @if (incidentsResource.isLoading()) {
          <ul class="incidents skeleton-list" role="list" aria-label="Loading incidents">
            @for (i of [1, 2, 3]; track i) {
              <li class="incident skeleton-item">
                <div class="incident-main">
                  <app-skeleton width="140px" height="1.1rem" />
                  <div class="meta-skeleton">
                    <app-skeleton width="60px" height="0.9rem" />
                    <app-skeleton width="80px" height="0.9rem" />
                  </div>
                </div>
                <app-skeleton variant="button" width="60px" height="32px" />
              </li>
            }
          </ul>
        } @else if (incidentsResource.error()) {
          <p class="error" role="alert">Unable to load incidents.</p>
        } @else if (recentIncidents().length === 0) {
          <div class="empty-state">
            <p class="muted">No incidents recorded yet.</p>
          </div>
        } @else {
          <ul class="incidents" role="list">
            @for (incident of recentIncidents(); track incident.id; let i = $index) {
              <li class="incident stagger-item">
                <div class="incident-main">
                  <div class="title">{{ formatDateTime(incident.occurredAtUtc) }}</div>
                  <div class="meta">
                    <span>{{ functionLabels[incident.function] }}</span>
                    <span class="dot">&middot;</span>
                    <span>{{ incident.place }}</span>
                  </div>
                </div>
                <a class="link-pill" [routerLink]="['/incidents', incident.id]">View</a>
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
    }
    .context-bar {
      display: flex;
      align-items: center;
      gap: var(--space-3, 0.75rem);
      padding: var(--space-2, 0.5rem) 0;
    }
    .context-label {
      color: var(--color-text-muted, #64748b);
      font-size: var(--font-size-sm, 0.8125rem);
      font-weight: 500;
    }
    .range-buttons {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
      background: #f1f5f9;
      border-radius: var(--radius-full, 999px);
    }
    .range-button {
      border: none;
      background: transparent;
      padding: 0.3rem 0.65rem;
      border-radius: var(--radius-full, 999px);
      font-weight: 600;
      font-size: var(--font-size-sm, 0.8125rem);
      cursor: pointer;
      color: #475569;
      transition: background var(--transition-fast, 120ms ease), color var(--transition-fast, 120ms ease);
    }
    .range-button:hover {
      background: #e2e8f0;
    }
    .range-button.active {
      background: var(--color-primary, #0c4a6e);
      color: #fff;
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
      font-size: var(--font-size-lg, 1.125rem);
      font-weight: 600;
    }
    .muted {
      margin: 0;
      color: var(--color-text-muted, #64748b);
      font-size: var(--font-size-sm, 0.8125rem);
    }
    .empty-state {
      display: grid;
      gap: var(--space-3, 0.75rem);
      padding: var(--space-3, 0.75rem) 0;
    }
    .error {
      margin: 0;
      color: #b91c1c;
      font-weight: 600;
    }
    .link-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.3rem 0.7rem;
      border-radius: var(--radius-full, 999px);
      border: 1px solid var(--color-border, #e2e8f0);
      text-decoration: none;
      color: #0f172a;
      font-weight: 600;
      font-size: var(--font-size-sm, 0.8125rem);
      background: #fff;
      transition: border-color var(--transition-fast, 120ms ease);
    }
    .link-pill:hover {
      border-color: var(--color-primary, #0c4a6e);
    }
    .incidents {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: var(--space-3, 0.75rem);
    }
    .incident {
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-2, 0.5rem);
      padding: var(--space-3, 0.75rem);
      display: flex;
      justify-content: space-between;
      gap: var(--space-3, 0.75rem);
      flex-wrap: wrap;
      align-items: center;
      background: #fff;
    }
    .incident-main {
      display: grid;
      gap: 0.25rem;
    }
    .title {
      font-weight: 600;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--color-text-muted, #64748b);
      font-size: var(--font-size-sm, 0.8125rem);
      flex-wrap: wrap;
    }
    .meta-skeleton {
      display: flex;
      gap: var(--space-2, 0.5rem);
    }
    .dot {
      color: #94a3b8;
    }
    .skeleton-item {
      padding: var(--space-4, 1rem);
    }

  `]
})
export class HomeComponent {
  private readonly participants = inject(ParticipantService);

  readonly activeParticipantId = this.participants.activeParticipantId;
  private readonly refreshTick = signal(0);
  readonly rangeDays = signal<7 | 14 | 30>(7);
  readonly rangeOptions: RangeOption[] = [
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' }
  ];

  readonly incidentsResource = httpResource<IncidentsResponse>(() => {
    const participantId = this.activeParticipantId();
    const range = this.rangeDays();
    this.refreshTick();
    const toUtc = new Date().toISOString();
    const fromUtc = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/incidents`,
        method: 'GET',
        params: { pageSize: '1', fromUtc, toUtc }
      };
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/incidents`,
      method: 'GET',
      params: { pageSize: '100', fromUtc, toUtc }
    };
  });

  readonly incidents = computed(() =>
    this.incidentsResource.hasValue() ? this.incidentsResource.value().items : []
  );

  readonly incidentsCount = computed(() => this.incidents().length);
  readonly recentIncidents = computed(() => this.incidents().slice(0, 3));

  readonly functionLabels = functionLabels;

  setRange(value: 7 | 14 | 30) {
    this.rangeDays.set(value);
  }

  formatDateTime(value: string): string {
    const parsed = new Date(value);
    return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
}
