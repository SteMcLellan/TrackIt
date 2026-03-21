import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ParticipantService } from '../../shared/services/participant.service';
import { BehaviorIncidentService } from '../../shared/services/behavior-incident.service';
import { BehaviorFunction, BehaviorIncident } from '../../shared/models/behavior-incident';
import {
  computeTzOffsetMinutes,
  extractLocalDate,
  extractLocalTime,
  toDatetimeLocalInput
} from '../../shared/utils/datetime';

type FunctionOption = {
  value: BehaviorFunction;
  label: string;
};

const FUNCTION_OPTIONS: FunctionOption[] = [
  { value: 'sensory', label: 'Sensory' },
  { value: 'tangible', label: 'Tangible' },
  { value: 'escape', label: 'Escape' },
  { value: 'attention', label: 'Attention' }
];

const FUNCTION_LABELS: Record<BehaviorFunction, string> = {
  sensory: 'Sensory',
  tangible: 'Tangible',
  escape: 'Escape',
  attention: 'Attention'
};

function formatDisplayDate(logLocalDate: string, logLocalTime: string): string {
  const parts = logLocalDate.split('-').map(Number);
  const timeParts = logLocalTime.split(':').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1]);
  const datePart = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} at ${timePart}`;
}

@Component({
  selector: 'app-incident-detail',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a class="back-link" routerLink="/incidents">
        <span class="material-symbols-outlined">arrow_back</span>
        Incidents
      </a>

      @if (loading()) {
        <p class="status-text">Loading incident…</p>
      } @else if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
        <a class="button secondary" routerLink="/incidents">Back to incidents</a>
      } @else if (incident()) {
        @if (!editMode()) {
          <!-- View mode -->
          <section class="hero">
            <h1>Incident</h1>
            <p class="muted">{{ formatDate(incident()!.logLocalDate, incident()!.logLocalTime) }}</p>
          </section>

          <section class="detail-card function-card">
            <span class="card-label">Function of Behavior</span>
            <span class="function-value">{{ functionLabel(incident()!.function) }}</span>
          </section>

          <section class="detail-card antecedent-card">
            <div class="abc-header">
              <span class="badge badge-a">A</span>
              <span class="abc-title">Antecedent</span>
            </div>
            <p class="detail-text">{{ incident()!.antecedent }}</p>
          </section>

          <section class="detail-card behavior-card">
            <div class="abc-header">
              <span class="badge badge-b">B</span>
              <span class="abc-title">Behavior</span>
            </div>
            <p class="detail-text">{{ incident()!.behavior }}</p>
          </section>

          <section class="detail-card consequence-card">
            <div class="abc-header">
              <span class="badge badge-c">C</span>
              <span class="abc-title">Consequence</span>
            </div>
            <p class="detail-text">{{ incident()!.consequence }}</p>
          </section>

          <section class="detail-card place-card">
            <span class="card-label">Place</span>
            <span class="place-value">{{ incident()!.place }}</span>
          </section>

          <div class="actions">
            <button type="button" class="button" (click)="enterEditMode()">Edit</button>
            @if (!confirmingDelete()) {
              <button type="button" class="button danger-outline" (click)="confirmingDelete.set(true)">Delete</button>
            } @else {
              <div class="delete-confirm">
                <p class="delete-prompt">Delete this incident? This cannot be undone.</p>
                <div class="delete-actions">
                  <button type="button" class="button danger" [disabled]="deleting()" (click)="deleteIncident()">
                    {{ deleting() ? 'Deleting…' : 'Yes, delete' }}
                  </button>
                  <button type="button" class="button secondary" (click)="confirmingDelete.set(false)">Cancel</button>
                </div>
              </div>
            }
          </div>
        } @else {
          <!-- Edit mode -->
          <section class="hero">
            <h1>Edit Incident</h1>
            <p class="muted">Update the details of this incident.</p>
          </section>

          <section class="detail-card function-card">
            <h2>Function of Behavior</h2>
            <div class="function-grid" role="group" aria-label="Behavior function">
              @for (opt of functionOptions; track opt.value) {
                <button
                  type="button"
                  class="function-option"
                  [class.selected]="editFunction() === opt.value"
                  (click)="editFunction.set(opt.value)"
                >{{ opt.label }}</button>
              }
            </div>
          </section>

          <section class="detail-card antecedent-card">
            <div class="abc-header">
              <span class="badge badge-a">A</span>
              <span class="abc-title">Antecedent</span>
            </div>
            <textarea
              class="notes"
              placeholder="Describe what happened before…"
              [value]="editAntecedent()"
              (input)="editAntecedent.set(asTextarea($event).value)"
              rows="3"
            ></textarea>
          </section>

          <section class="detail-card behavior-card">
            <div class="abc-header">
              <span class="badge badge-b">B</span>
              <span class="abc-title">Behavior</span>
            </div>
            <textarea
              class="notes"
              placeholder="Describe the behavior…"
              [value]="editBehavior()"
              (input)="editBehavior.set(asTextarea($event).value)"
              rows="3"
            ></textarea>
          </section>

          <section class="detail-card consequence-card">
            <div class="abc-header">
              <span class="badge badge-c">C</span>
              <span class="abc-title">Consequence</span>
            </div>
            <textarea
              class="notes"
              placeholder="What was the outcome?"
              [value]="editConsequence()"
              (input)="editConsequence.set(asTextarea($event).value)"
              rows="3"
            ></textarea>
          </section>

          <section class="detail-card place-card">
            <span class="card-label">Place</span>
            <input
              type="text"
              class="place-input"
              placeholder="Where did this happen?"
              [value]="editPlace()"
              (input)="editPlace.set(asInput($event).value)"
            />
          </section>

          <section class="datetime-grid">
            <div class="datetime-card">
              <label for="editDate">Date</label>
              <input
                id="editDate"
                type="date"
                [value]="editDatePart()"
                (change)="onEditDateChange($event)"
              />
            </div>
            <div class="datetime-card">
              <label for="editTime">Time</label>
              <input
                id="editTime"
                type="time"
                [value]="editTimePart()"
                (change)="onEditTimeChange($event)"
              />
            </div>
          </section>

          @if (saveError()) {
            <p class="error" role="alert">{{ saveError() }}</p>
          }

          <div class="actions">
            <button
              type="button"
              class="button"
              [disabled]="!canSave() || saving()"
              (click)="saveEdit()"
            >{{ saving() ? 'Saving…' : 'Save changes' }}</button>
            <button type="button" class="button secondary" (click)="cancelEdit()">Cancel</button>
          </div>
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

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-electric-violet, #8b5cf6);
      text-decoration: none;
      margin-bottom: 1rem;
    }

    .back-link .material-symbols-outlined {
      font-size: 1.125rem;
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

    .detail-card {
      border-radius: 0.875rem;
      padding: 1rem;
      margin-bottom: 1rem;
      background: #ffffff;
      border: 1px solid #f1f5f9;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
    }

    .function-card {
      background: var(--color-soft-violet, #f5f3ff);
      border: none;
    }

    .antecedent-card {
      background: var(--color-soft-amber, #fffbeb);
      border: none;
    }

    .behavior-card {
      background: var(--color-soft-violet, #f5f3ff);
      border: none;
    }

    .consequence-card {
      background: var(--color-soft-emerald, #ecfdf5);
      border: none;
    }

    .place-card {
      background: var(--color-soft-azure, #f0f9ff);
      border: none;
    }

    .card-label {
      display: block;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      margin-bottom: 0.375rem;
    }

    .function-value,
    .place-value {
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-midnight-slate, #1e293b);
    }

    .abc-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.625rem;
    }

    .badge {
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 0.375rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .badge-a { background: var(--color-energetic-amber, #f59e0b); }
    .badge-b { background: var(--color-electric-violet, #8b5cf6); }
    .badge-c { background: var(--color-vital-emerald, #10b981); }

    .abc-title {
      font-size: 0.875rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-midnight-slate, #1e293b);
    }

    .detail-text {
      margin: 0;
      font-size: 0.9375rem;
      line-height: 1.5;
      color: var(--color-midnight-slate, #1e293b);
      white-space: pre-wrap;
    }

    h2 {
      margin: 0 0 0.75rem;
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-electric-violet, #8b5cf6);
    }

    .function-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .function-option {
      min-height: 44px;
      border-radius: 1rem;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      color: var(--color-midnight-slate, #1e293b);
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.75rem;
      cursor: pointer;
    }

    .function-option.selected {
      border-color: var(--color-electric-violet, #8b5cf6);
      background: var(--color-electric-violet, #8b5cf6);
      color: #ffffff;
    }

    .notes {
      width: 100%;
      box-sizing: border-box;
      border-radius: 0.75rem;
      border: 1px solid #e2e8f0;
      min-height: 44px;
      padding: 0.75rem;
      resize: vertical;
      font: inherit;
    }

    .place-input {
      width: 100%;
      box-sizing: border-box;
      border-radius: 0.75rem;
      border: 1px solid #e2e8f0;
      min-height: 44px;
      padding: 0.625rem 0.75rem;
      font: inherit;
    }

    .datetime-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .datetime-card {
      border: 1px solid #e2e8f0;
      border-radius: 0.875rem;
      background: #ffffff;
      padding: 0.75rem;
    }

    .datetime-card label {
      display: block;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.6875rem;
      font-weight: 700;
      color: #94a3b8;
      margin-bottom: 0.5rem;
    }

    .datetime-card input {
      width: 100%;
      min-height: 44px;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 0.625rem 0.75rem;
      box-sizing: border-box;
      font: inherit;
      background: #fff;
    }

    .actions {
      display: grid;
      gap: 0.75rem;
    }

    .button {
      min-height: 44px;
      border: 0;
      border-radius: 999px;
      padding: 0.625rem 1rem;
      font-weight: 700;
      font-size: 0.9375rem;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--color-electric-violet, #8b5cf6);
      color: #ffffff;
      cursor: pointer;
    }

    .button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .button.secondary {
      background: transparent;
      border: 1px solid var(--color-primary, #0c4a6e);
      color: var(--color-primary, #0c4a6e);
    }

    .button.danger-outline {
      background: transparent;
      border: 1px solid #b91c1c;
      color: #b91c1c;
    }

    .button.danger {
      background: #b91c1c;
      color: #ffffff;
    }

    .delete-confirm {
      border-radius: 0.875rem;
      border: 1px solid #fecaca;
      background: #fff1f2;
      padding: 1rem;
    }

    .delete-prompt {
      margin: 0 0 0.75rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #b91c1c;
    }

    .delete-actions {
      display: grid;
      gap: 0.5rem;
    }

    .error {
      margin: 0 0 1rem;
      color: #b91c1c;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .status-text {
      text-align: center;
      color: var(--color-text-muted, #64748b);
      font-size: 0.875rem;
      margin: 2rem 0;
    }
  `]
})
export class IncidentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly participantService = inject(ParticipantService);
  private readonly incidentService = inject(BehaviorIncidentService);

  readonly functionOptions = FUNCTION_OPTIONS;

  readonly incident = signal<BehaviorIncident | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly editMode = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);

  // Edit form signals
  readonly editFunction = signal<BehaviorFunction | null>(null);
  readonly editAntecedent = signal('');
  readonly editBehavior = signal('');
  readonly editConsequence = signal('');
  readonly editPlace = signal('');
  readonly editDatetime = signal('');

  ngOnInit(): void {
    const editParam = this.route.snapshot.queryParamMap.get('edit');
    if (editParam === 'true') {
      this.editMode.set(true);
    }
    this.loadIncident();
  }

  formatDate(logLocalDate: string, logLocalTime: string): string {
    return formatDisplayDate(logLocalDate, logLocalTime);
  }

  functionLabel(fn: BehaviorFunction): string {
    return FUNCTION_LABELS[fn];
  }

  editDatePart(): string {
    return this.editDatetime().slice(0, 10);
  }

  editTimePart(): string {
    return this.editDatetime().slice(11, 16);
  }

  onEditDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.editDatetime.set(`${value}T${this.editTimePart()}`);
    }
  }

  onEditTimeChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.editDatetime.set(`${this.editDatePart()}T${value}`);
    }
  }

  canSave(): boolean {
    return (
      this.editFunction() !== null &&
      this.editAntecedent().trim().length > 0 &&
      this.editBehavior().trim().length > 0 &&
      this.editConsequence().trim().length > 0
    );
  }

  enterEditMode(): void {
    const inc = this.incident();
    if (!inc) return;
    this.editFunction.set(inc.function);
    this.editAntecedent.set(inc.antecedent);
    this.editBehavior.set(inc.behavior);
    this.editConsequence.set(inc.consequence);
    this.editPlace.set(inc.place);
    this.editDatetime.set(toDatetimeLocalInput(inc.logLocalDate, inc.logLocalTime));
    this.saveError.set(null);
    this.editMode.set(true);
  }

  cancelEdit(): void {
    this.editMode.set(false);
    this.saveError.set(null);
  }

  saveEdit(): void {
    if (!this.canSave() || this.saving()) return;

    const participantId = this.participantService.activeParticipantId();
    const inc = this.incident();
    if (!participantId || !inc) return;

    const fn = this.editFunction();
    if (!fn) return;

    const datetimeLocal = this.editDatetime();
    const logLocalDate = extractLocalDate(datetimeLocal);
    const logLocalTime = extractLocalTime(datetimeLocal);
    const logTzOffsetMinutes = computeTzOffsetMinutes(logLocalDate, logLocalTime);

    this.saving.set(true);
    this.saveError.set(null);

    this.incidentService.updateIncident(participantId, inc.id, {
      function: fn,
      antecedent: this.editAntecedent().trim(),
      behavior: this.editBehavior().trim(),
      consequence: this.editConsequence().trim(),
      place: this.editPlace().trim() || inc.place,
      logLocalDate,
      logLocalTime,
      logTzOffsetMinutes
    }).subscribe({
      next: (updated) => {
        this.incident.set(updated);
        this.saving.set(false);
        this.editMode.set(false);
      },
      error: () => {
        this.saveError.set('Unable to save changes. Please try again.');
        this.saving.set(false);
      }
    });
  }

  deleteIncident(): void {
    if (this.deleting()) return;

    const participantId = this.participantService.activeParticipantId();
    const inc = this.incident();
    if (!participantId || !inc) return;

    this.deleting.set(true);

    this.incidentService.deleteIncident(participantId, inc.id).subscribe({
      next: () => {
        this.router.navigate(['/incidents']);
      },
      error: () => {
        this.error.set('Unable to delete incident. Please try again.');
        this.deleting.set(false);
        this.confirmingDelete.set(false);
      }
    });
  }

  asTextarea(event: Event): HTMLTextAreaElement {
    return event.target as HTMLTextAreaElement;
  }

  asInput(event: Event): HTMLInputElement {
    return event.target as HTMLInputElement;
  }

  private loadIncident(): void {
    const participantId = this.participantService.activeParticipantId();
    const incidentId = this.route.snapshot.paramMap.get('id');

    if (!participantId || !incidentId) {
      this.error.set('Unable to load incident.');
      return;
    }

    this.loading.set(true);

    this.incidentService.getIncident(participantId, incidentId).subscribe({
      next: (inc) => {
        this.incident.set(inc);
        this.loading.set(false);
        // If we entered edit mode before the incident loaded, populate form now
        if (this.editMode()) {
          this.enterEditMode();
        }
      },
      error: () => {
        this.error.set('Incident not found or could not be loaded.');
        this.loading.set(false);
      }
    });
  }
}
