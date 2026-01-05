import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card/card.component';
import { ParticipantService } from '../../shared/services/participant.service';
import { BehaviorIncidentService } from '../../shared/services/behavior-incident.service';
import { BehaviorFunction } from '../../shared/models/behavior-incident';

type FunctionOption = {
  value: BehaviorFunction;
  label: string;
};

export const functionOptions: FunctionOption[] = [
  { value: 'sensory', label: 'Automatically Rewarding (Sensory)' },
  { value: 'tangible', label: 'Get What They Want' },
  { value: 'escape', label: 'Avoid' },
  { value: 'attention', label: 'Attention' }
];

export function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function toUtcIsoString(localValue: string): string {
  const parsed = new Date(localValue);
  return parsed.toISOString();
}

export function toLocalDateInputValue(utcValue: string): string {
  const date = new Date(utcValue);
  return toLocalInputValue(date);
}

@Component({
  selector: 'app-incident-create',
  imports: [ReactiveFormsModule, RouterLink, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card class="card">
      <h2>Log an incident</h2>
      <p class="muted">
        Use the A.B.C. model to capture what happened and why.
      </p>

      @if (!activeParticipantId()) {
        <p class="error" role="alert">Select a participant before logging an incident.</p>
        <a class="button secondary" routerLink="/participants">Select participant</a>
      } @else if (created()) {
        <p class="muted">Incident saved. You can log another or return later.</p>
        <div class="actions">
          <button class="button" type="button" (click)="reset()">Log another incident</button>
          <a class="button secondary" routerLink="/dashboard">Back to dashboard</a>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="grid">
          <div class="row">
            <div>
              <label for="occurredAt">Time (UTC)</label>
              <input
                id="occurredAt"
                type="datetime-local"
                formControlName="occurredAt"
                required
              />
            </div>
            <div>
              <label for="place">Place</label>
              <input
                id="place"
                type="text"
                formControlName="place"
                placeholder="e.g., kitchen, classroom, car"
                required
              />
            </div>
          </div>

          <div class="abc-grid">
            <div>
              <label for="antecedent">Antecedent</label>
              <p class="helper">What happened right before the behavior?</p>
              <textarea id="antecedent" rows="4" formControlName="antecedent" required></textarea>
            </div>
            <div>
              <label for="behavior">Behavior</label>
              <p class="helper">Describe what was observed.</p>
              <textarea id="behavior" rows="4" formControlName="behavior" required></textarea>
            </div>
            <div>
              <label for="consequence">Consequence</label>
              <p class="helper">What happened right after?</p>
              <textarea id="consequence" rows="4" formControlName="consequence" required></textarea>
            </div>
          </div>

          <label for="function">Function of behavior</label>
          <select id="function" formControlName="function" required>
            <option value="" disabled>Select one</option>
            @for (option of functionOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>

          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }

          <button class="button" type="submit" [disabled]="form.invalid || saving()">
            @if (saving()) {
              Saving...
            } @else {
              Save incident
            }
          </button>
        </form>
      }
    </app-card>
  `,
  styles: [
    `
      .card {
        width: 100%;
        max-width: none;
        margin: 0;
        box-sizing: border-box;
      }
      .grid {
        display: grid;
        gap: var(--space-3, 0.75rem);
      }
      .row {
        display: grid;
        gap: var(--space-3, 0.75rem);
      }
      .abc-grid {
        display: grid;
        gap: var(--space-3, 0.75rem);
      }
      @media (min-width: 900px) {
        .row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .abc-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      h2 {
        margin: 0 0 var(--space-2, 0.5rem);
      }
      label {
        display: block;
        margin: 0 0 var(--space-1, 0.25rem);
        font-weight: 600;
      }
      input,
      select,
      textarea {
        width: 100%;
        padding: 0.6rem 0.75rem;
        border-radius: var(--radius-2, 0.5rem);
        border: 1px solid #cbd5f5;
        margin-bottom: var(--space-3, 0.75rem);
        font-size: 1rem;
        font-family: inherit;
        box-sizing: border-box;
      }
      .muted {
        margin: 0 0 var(--space-3, 0.75rem);
        color: var(--color-text-muted, #64748b);
      }
      .helper {
        margin: 0 0 var(--space-2, 0.5rem);
        color: var(--color-text-muted, #64748b);
      }
      .error {
        margin: 0 0 var(--space-3, 0.75rem);
        color: #b91c1c;
        font-weight: 600;
      }
      .actions {
        display: flex;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
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
      .button[disabled] {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `
  ]
})
export class IncidentCreateComponent {
  private readonly participants = inject(ParticipantService);
  private readonly incidents = inject(BehaviorIncidentService);
  private readonly fb = inject(FormBuilder);

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly created = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly functionOptions = functionOptions;

  readonly form = this.fb.group({
    occurredAt: this.fb.nonNullable.control(toLocalInputValue(new Date()), { validators: [Validators.required] }),
    place: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    function: this.fb.nonNullable.control<BehaviorFunction | ''>('', { validators: [Validators.required] }),
    antecedent: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    behavior: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    consequence: this.fb.nonNullable.control('', { validators: [Validators.required] })
  });

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const participantId = this.activeParticipantId();
    if (!participantId) {
      this.error.set('Select a participant before logging an incident.');
      return;
    }

    const occurredAt = toUtcIsoString(this.form.controls.occurredAt.value);

    this.saving.set(true);
    this.error.set(null);

    this.incidents.createIncident(participantId, {
      antecedent: this.form.controls.antecedent.value.trim(),
      behavior: this.form.controls.behavior.value.trim(),
      consequence: this.form.controls.consequence.value.trim(),
      occurredAtUtc: occurredAt,
      place: this.form.controls.place.value.trim(),
      function: this.form.controls.function.value as BehaviorFunction
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.created.set(true);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Unable to save incident. Please try again.');
      }
    });
  }

  reset(): void {
    this.form.reset({
      occurredAt: toLocalInputValue(new Date()),
      place: '',
      function: '',
      antecedent: '',
      behavior: '',
      consequence: ''
    });
    this.created.set(false);
  }
}
