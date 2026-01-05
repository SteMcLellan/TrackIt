import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CardComponent } from '../../shared/ui/card/card.component';
import { BehaviorIncident, BehaviorFunction } from '../../shared/models/behavior-incident';
import { ParticipantService } from '../../shared/services/participant.service';
import { environment } from '../../../environments/environment';
import { FunctionAttentionIconComponent } from '../../shared/ui/icons/function-attention-icon.component';
import { FunctionEscapeIconComponent } from '../../shared/ui/icons/function-escape-icon.component';
import { FunctionSensoryIconComponent } from '../../shared/ui/icons/function-sensory-icon.component';
import { FunctionTangibleIconComponent } from '../../shared/ui/icons/function-tangible-icon.component';
import { IncidentEditFormComponent } from './incident-edit-form.component';
import { BehaviorIncidentService } from '../../shared/services/behavior-incident.service';

const functionLabels: Record<BehaviorFunction, string> = {
  sensory: 'Automatically Rewarding (Sensory)',
  tangible: 'Get What They Want',
  escape: 'Avoid',
  attention: 'Attention'
};

@Component({
  selector: 'app-incident-detail',
  imports: [
    RouterLink,
    CardComponent,
    FunctionAttentionIconComponent,
    FunctionEscapeIconComponent,
    FunctionSensoryIconComponent,
    FunctionTangibleIconComponent,
    IncidentEditFormComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card class="card">
      <a class="link" routerLink="/incidents">Back to incidents</a>

      @if (!activeParticipantId()) {
        <p class="error" role="alert">Select a participant to view incidents.</p>
        <a class="button secondary" routerLink="/participants">Select participant</a>
      } @else if (incidentResource.isLoading()) {
        <p class="muted">Loading incident...</p>
      } @else if (incidentResource.error()) {
        <p class="error" role="alert">Unable to load incident.</p>
      } @else {
        <div class="summary">
          <div class="summary-header">
            <h2>{{ formatDate(incident()?.occurredAtUtc || '') }}</h2>
            @if (!editing()) {
              <div class="actions">
                <button class="button secondary" type="button" (click)="startEdit()">
                  Edit
                </button>
                <button class="button danger" type="button" (click)="confirmDelete()">
                  Delete
                </button>
              </div>
            }
          </div>
          <div class="meta">
            <span class="function">
              <span class="icon" aria-hidden="true">
                @switch (incident()?.function) {
                  @case ('sensory') { <app-icon-function-sensory /> }
                  @case ('tangible') { <app-icon-function-tangible /> }
                  @case ('escape') { <app-icon-function-escape /> }
                  @case ('attention') { <app-icon-function-attention /> }
                }
              </span>
              <span>{{ incident() ? functionLabels[incident()!.function] : '' }}</span>
            </span>
            <span class="dot">&middot;</span>
            <span>{{ incident()?.place }}</span>
          </div>
        </div>

        @if (editing()) {
          <app-incident-edit-form
            [incident]="incident()!"
            (cancel)="cancelEdit()"
            (saved)="handleSaved($event)"
            (remove)="confirmDelete()"
          />
        } @else {
          <div class="section">
            <h3>Antecedent</h3>
            <p>{{ incident()?.antecedent }}</p>
          </div>
          <div class="section">
            <h3>Behavior</h3>
            <p>{{ incident()?.behavior }}</p>
          </div>
          <div class="section">
            <h3>Consequence</h3>
            <p>{{ incident()?.consequence }}</p>
          </div>
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
      .link {
        display: inline-flex;
        margin-bottom: var(--space-3, 0.75rem);
        color: var(--color-primary, #0c4a6e);
        font-weight: 600;
        text-decoration: none;
      }
      .summary {
        margin-bottom: var(--space-4, 1rem);
      }
      .summary-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
      }
      h2 {
        margin: 0 0 var(--space-2, 0.5rem);
      }
      .meta {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--color-text-muted, #64748b);
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
      .section {
        border-top: 1px solid #e2e8f0;
        padding-top: var(--space-3, 0.75rem);
        margin-top: var(--space-3, 0.75rem);
      }
      .section h3 {
        margin: 0 0 var(--space-1, 0.25rem);
      }
      .section p {
        margin: 0;
      }
      .muted {
        margin: 0 0 var(--space-3, 0.75rem);
        color: var(--color-text-muted, #64748b);
      }
      .error {
        margin: 0 0 var(--space-3, 0.75rem);
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
      }
      .button.secondary {
        background: #fff;
        color: var(--color-primary, #0c4a6e);
        border: 1px solid var(--color-primary, #0c4a6e);
      }
      .button.danger {
        background: #b91c1c;
        color: #fff;
      }
      .actions {
        display: flex;
        gap: var(--space-2, 0.5rem);
        flex-wrap: wrap;
      }
    `
  ]
})
export class IncidentDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly participants = inject(ParticipantService);
  private readonly incidents = inject(BehaviorIncidentService);

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly incidentId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' }
  );
  readonly editMode = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('edit') === 'true')),
    { initialValue: false }
  );

  readonly incidentResource = httpResource<BehaviorIncident>(() => ({
    url: `${environment.apiBaseUrl}/participants/${this.activeParticipantId() ?? ''}/incidents/${this.incidentId()}`,
    method: 'GET'
  }));

  readonly incidentOverride = signal<BehaviorIncident | null>(null);
  readonly editing = signal(false);

  readonly incident = computed(() =>
    this.incidentOverride() ?? (this.incidentResource.hasValue() ? this.incidentResource.value() : null)
  );

  readonly functionLabels = functionLabels;

  constructor() {
    effect(() => {
      if (this.editMode() && this.incident() && !this.editing()) {
        this.editing.set(true);
      }
    });
  }

  formatDate(value: string): string {
    if (!value) {
      return 'Incident';
    }
    const parsed = new Date(value);
    return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  startEdit() {
    if (this.incident()) {
      this.editing.set(true);
    }
  }

  cancelEdit() {
    this.editing.set(false);
    if (this.editMode()) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { edit: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
  }

  handleSaved(updated: BehaviorIncident) {
    this.incidentOverride.set(updated);
    this.editing.set(false);
  }

  confirmDelete() {
    const incident = this.incident();
    if (!incident) {
      return;
    }
    const occurredAt = new Date(incident.occurredAtUtc);
    const ageDays = (Date.now() - occurredAt.getTime()) / (1000 * 60 * 60 * 24);
    const message =
      ageDays > 30
        ? 'This is an older incident. Are you sure you want to delete it?'
        : 'Are you sure you want to delete this incident?';
    if (!window.confirm(message)) {
      return;
    }

    this.incidents.deleteIncident(incident.participantId, incident.id).subscribe({
      next: () => {
        window.alert('Incident deleted.');
        window.history.back();
      },
      error: () => {
        window.alert('Unable to delete incident.');
      }
    });
  }
}



