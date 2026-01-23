import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { BottomSheetComponent } from '../../shared/ui/page/bottom-sheet.component';
import { PageTitleComponent } from '../../shared/ui/page/page-title.component';
import { DateRangeSelectorComponent, DateRangeOption } from '../../shared/ui/filters/date-range-selector.component';
import { FunctionAttentionIconComponent } from '../../shared/ui/icons/function-attention-icon.component';
import { FunctionEscapeIconComponent } from '../../shared/ui/icons/function-escape-icon.component';
import { FunctionSensoryIconComponent } from '../../shared/ui/icons/function-sensory-icon.component';
import { FunctionTangibleIconComponent } from '../../shared/ui/icons/function-tangible-icon.component';
import { BehaviorIncident, BehaviorFunction } from '../../shared/models/behavior-incident';
import { ParticipantService } from '../../shared/services/participant.service';
import { BehaviorIncidentService } from '../../shared/services/behavior-incident.service';
import { environment } from '../../../environments/environment';
import { IncidentEditFormComponent } from './incident-edit-form.component';
import { IncidentListItemComponent } from './incident-list-item.component';

type IncidentsResponse = {
  items: BehaviorIncident[];
  nextToken: string | null;
};

const functionLabels: Record<BehaviorFunction, string> = {
  sensory: 'Sensory',
  tangible: 'Tangible',
  escape: 'Escape',
  attention: 'Attention'
};

@Component({
  selector: 'app-incident-list',
  imports: [
    RouterLink,
    CardComponent,
    SkeletonComponent,
    BottomSheetComponent,
    PageTitleComponent,
    DateRangeSelectorComponent,
    IncidentEditFormComponent,
    IncidentListItemComponent,
    FunctionAttentionIconComponent,
    FunctionEscapeIconComponent,
    FunctionSensoryIconComponent,
    FunctionTangibleIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <app-page-title
        title="Incidents"
        subtitle="Review behavior incidents for the active participant."
      />

      <app-date-range-selector
        [selectedRange]="rangeDays()"
        (rangeChanged)="setRange($event)"
      />

      <app-card class="card">

      @if (!activeParticipantId()) {
        <p class="error" role="alert">Select a participant to view incidents.</p>
        <a class="select-link" routerLink="/participants">Select participant &rarr;</a>
      } @else if (incidentsResource.isLoading()) {
        <ul class="list" role="list" aria-label="Loading incidents">
          @for (i of [1, 2, 3]; track i) {
            <li class="compact-item skeleton-item">
              <div class="compact-content">
                <app-skeleton width="100px" height="0.85rem" />
                <app-skeleton width="200px" height="0.9rem" />
              </div>
            </li>
          }
        </ul>
      } @else if (incidentsResource.error()) {
        <p class="error" role="alert">Unable to load incidents.</p>
      } @else {
        <div class="filters">
          <div class="filter-group">
            <div class="filter-header">
              <div class="filter-title">Function</div>
              @if (functionFilter() !== 'all') {
                <button type="button" class="clear-link" (click)="clearFunctionFilter()">Clear filter</button>
              }
            </div>
            <div class="function-grid" role="group" aria-label="Behavior function">
              @for (option of functionOptions; track option.value) {
                <button
                  type="button"
                  class="function-card"
                  [class.active]="functionFilter() === option.value"
                  [attr.aria-pressed]="functionFilter() === option.value"
                  (click)="toggleFunction(option.value)"
                >
                  <span class="function-icon" aria-hidden="true">
                    @switch (option.value) {
                      @case ('sensory') { <app-icon-function-sensory /> }
                      @case ('tangible') { <app-icon-function-tangible /> }
                      @case ('escape') { <app-icon-function-escape /> }
                      @case ('attention') { <app-icon-function-attention /> }
                    }
                  </span>
                  <span class="function-name">{{ functionShortLabel(option.value) }}</span>
                </button>
              }
            </div>
          </div>
        </div>

        @if (incidents().length === 0) {
          <div class="empty">
            @if (hasAnyIncidents()) {
              <p class="muted">
                No incidents match the selected function.
                <button type="button" class="text-link" (click)="clearFunctionFilter()">Clear filter</button>.
              </p>
            } @else {
              <p class="muted">No incidents yet. Tap the + button below to log your first one.</p>
            }
          </div>
        } @else {
          <ul class="list" role="list">
            @for (incident of incidents(); track incident.id) {
              <li>
                <app-incident-list-item
                  [incident]="incident"
                  (selected)="openEditSheet($event)"
                />
              </li>
            }
          </ul>
        }
      }
      </app-card>
    </div>

    @if (editSheetOpen()) {
      <app-bottom-sheet
        [open]="editSheetOpen()"
        [title]="'Edit Incident'"
        (closed)="closeEditSheet()"
      >
        @if (selectedIncident()) {
          <app-incident-edit-form
            [incident]="selectedIncident()!"
            (cancel)="closeEditSheet()"
            (saved)="onIncidentSaved($event)"
            (remove)="onIncidentRemove()"
          />
        }
      </app-bottom-sheet>
    }
  `,
  styles: [
    `
      .layout {
        display: grid;
        gap: var(--space-4);
        padding-bottom: var(--space-6);
      }
      .card {
        width: 100%;
        margin: 0;
        box-sizing: border-box;
      }
      .muted {
        margin: 0;
        color: var(--color-text-muted, #64748b);
        font-size: var(--font-size-sm, 0.8125rem);
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
        gap: var(--space-4, 1rem);
        margin-bottom: var(--space-4, 1rem);
      }
      .filter-group {
        border: 1px solid #e2e8f0;
        border-radius: var(--radius-2, 0.5rem);
        padding: var(--space-3, 0.75rem);
        background: #fff;
        display: grid;
        gap: var(--space-3, 0.75rem);
      }
      .filter-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2, 0.5rem);
      }
      .filter-title {
        font-weight: 700;
        color: #0f172a;
        font-size: 0.9rem;
      }
      .text-link {
        background: none;
        border: none;
        padding: 0;
        margin: 0;
        color: var(--color-primary, #0c4a6e);
        text-decoration: underline;
        text-underline-offset: 3px;
        font: inherit;
        font-weight: 650;
        cursor: pointer;
      }
      .text-link:hover {
        text-decoration-thickness: 2px;
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
      .function-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-2, 0.5rem);
      }
      .function-card {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 0.65rem;
        border-radius: var(--radius-2, 0.5rem);
        border: 1px solid #e2e8f0;
        background: #fff;
        cursor: pointer;
        text-align: left;
        transition: border-color var(--transition-fast, 120ms ease),
                    box-shadow var(--transition-fast, 120ms ease),
                    background var(--transition-fast, 120ms ease);
      }
      .function-card:hover {
        border-color: #cbd5f5;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
      }
      .function-card.active {
        border-color: var(--color-primary, #0c4a6e);
        background: rgba(12, 74, 110, 0.08);
        box-shadow: 0 4px 10px rgba(12, 74, 110, 0.18);
      }
      .function-icon {
        display: inline-flex;
        color: var(--color-primary, #0c4a6e);
        flex: 0 0 auto;
      }
      .function-name {
        font-weight: 700;
        color: #0f172a;
        font-size: 0.9rem;
      }
      .list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: var(--space-2, 0.5rem);
      }
      .skeleton-item {
        padding: var(--space-3, 0.75rem);
        border-left-color: #e2e8f0;
      }
      .compact-content {
        display: grid;
        gap: 0.35rem;
      }
      @media (min-width: 900px) {
        .filters {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: start;
        }
      }
    `
  ]
})
export class IncidentListComponent {
  private readonly participants = inject(ParticipantService);
  private readonly incidentService = inject(BehaviorIncidentService);

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly rangeDays = signal<DateRangeOption>(30);
  readonly functionFilter = signal<'all' | BehaviorFunction>('all');

  // Edit sheet state
  readonly editSheetOpen = signal(false);
  readonly selectedIncident = signal<BehaviorIncident | null>(null);

  readonly incidentsResource = httpResource<IncidentsResponse>(() => {
    const participantId = this.activeParticipantId();
    const range = this.rangeDays();
    const func = this.functionFilter();
    const toUtc = new Date().toISOString();
    const fromUtc = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();

    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/incidents`,
        method: 'GET',
        params: { pageSize: '1', fromUtc, toUtc }
      };
    }

    const params: Record<string, string> = { pageSize: '1000', fromUtc, toUtc };

    if (func !== 'all') {
      params['function'] = func;
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

  setRange(value: DateRangeOption) {
    this.rangeDays.set(value);
  }

  toggleFunction(value: BehaviorFunction) {
    this.functionFilter.set(this.functionFilter() === value ? 'all' : value);
  }

  clearFunctionFilter() {
    this.functionFilter.set('all');
  }

  functionShortLabel(value: BehaviorFunction) {
    return functionLabels[value];
  }

  openEditSheet(incident: BehaviorIncident): void {
    this.selectedIncident.set(incident);
    this.editSheetOpen.set(true);
  }

  closeEditSheet(): void {
    this.editSheetOpen.set(false);
    setTimeout(() => this.selectedIncident.set(null), 300);
  }

  onIncidentSaved(updated: BehaviorIncident): void {
    this.closeEditSheet();
    this.incidentsResource.reload();
  }

  onIncidentRemove(): void {
    const incident = this.selectedIncident();
    if (!incident) return;

    if (confirm('Are you sure you want to delete this incident?')) {
      this.incidentService.deleteIncident(incident.participantId, incident.id)
        .subscribe({
          next: () => {
            this.closeEditSheet();
            this.incidentsResource.reload();
          },
          error: () => {
            alert('Failed to delete incident. Please try again.');
          }
        });
    }
  }
}
