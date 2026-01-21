import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorIncident } from '../../shared/models/behavior-incident';
import { CollectionResponse } from '../../shared/models/collection';
import { ParticipantService } from '../../shared/services/participant.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { MedicationCheckinComponent } from '../medications/components/medication-checkin.component';
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
  imports: [CardComponent, RouterLink, MedicationCheckinComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <app-card class="card">
        <div class="header">
          <div>
            <h2>Home</h2>
            <p class="muted">Quick actions and today's check-in.</p>
          </div>
          <div class="header-actions">
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
        </div>
      </app-card>

      <app-medication-checkin [rangeDays]="rangeDays()" />

      <app-card class="card">
        <div class="header">
          <div>
            <h2>Incidents (last {{ rangeDays() }} days)</h2>
            @if (incidentsCount() > 0) {
              <p class="muted">{{ incidentsCount() }} in the last {{ rangeDays() }} days.</p>
            }
          </div>
          <div class="header-actions">
            <a class="button" routerLink="/incidents/new">Log incident</a>
            <a class="button secondary" routerLink="/incidents">View incidents</a>
          </div>
        </div>

        @if (incidentsResource.isLoading()) {
          <p class="muted">Loading incidents...</p>
        } @else if (incidentsResource.error()) {
          <p class="error" role="alert">Unable to load incidents.</p>
        } @else if (recentIncidents().length === 0) {
          <p class="muted">No incidents in the last {{ rangeDays() }} days.</p>
        } @else {
          <ul class="incidents" role="list">
            @for (incident of recentIncidents(); track incident.id) {
              <li class="incident">
                <div class="incident-main">
                  <div class="title">{{ formatDateTime(incident.occurredAtUtc) }}</div>
                  <div class="meta">
                    <span>{{ functionLabels[incident.function] }}</span>
                    <span class="dot">·</span>
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
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
        margin-bottom: var(--space-4, 1rem);
      }
      .header-actions {
        display: flex;
        gap: var(--space-2, 0.5rem);
        flex-wrap: wrap;
      }
      .range-buttons {
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
        font-weight: 700;
        cursor: pointer;
        color: #0f172a;
      }
      .range-button.active {
        background: #0c4a6e;
        color: #fff;
      }
      h2 {
        margin: 0 0 var(--space-2, 0.5rem);
        font-size: 1.35rem;
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
      .link-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        border: 1px solid #cbd5f5;
        text-decoration: none;
        color: #0f172a;
        font-weight: 600;
        background: #fff;
      }
      .incidents {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: var(--space-3, 0.75rem);
      }
      .incident {
        border: 1px solid #e2e8f0;
        border-radius: var(--radius-2, 0.5rem);
        padding: var(--space-4, 1rem);
        display: flex;
        justify-content: space-between;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
        align-items: center;
      }
      .incident-main {
        display: grid;
        gap: 0.35rem;
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
      .dot {
        color: var(--color-text-muted, #94a3b8);
      }
    `
  ]
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
