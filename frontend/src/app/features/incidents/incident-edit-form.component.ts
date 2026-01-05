import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorIncident, BehaviorFunction } from '../../shared/models/behavior-incident';
import { BehaviorIncidentService, UpdateBehaviorIncidentRequest } from '../../shared/services/behavior-incident.service';
import { functionOptions, toLocalDateInputValue, toUtcIsoString } from './incident-create.component';

@Component({
  selector: 'app-incident-edit-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="form" [formGroup]="form" (ngSubmit)="save()">
      <label for="occurredAt">Time (UTC)</label>
      <input
        id="occurredAt"
        type="datetime-local"
        formControlName="occurredAt"
        required
      />

      <label for="place">Place</label>
      <input
        id="place"
        type="text"
        formControlName="place"
        placeholder="e.g., kitchen, classroom, car"
        required
      />

      <label for="antecedent">Antecedent</label>
      <p class="helper">What happened right before the behavior?</p>
      <textarea id="antecedent" rows="4" formControlName="antecedent" required></textarea>

      <label for="behavior">Behavior</label>
      <p class="helper">Describe what was observed.</p>
      <textarea id="behavior" rows="4" formControlName="behavior" required></textarea>

      <label for="consequence">Consequence</label>
      <p class="helper">What happened right after?</p>
      <textarea id="consequence" rows="4" formControlName="consequence" required></textarea>

      <label for="function">Function of behavior</label>
      <select id="function" formControlName="function" required>
        <option value="" disabled>Select one</option>
        @for (option of functionOptions; track option.value) {
          <option [value]="option.value">{{ option.label }}</option>
        }
      </select>

      @if (warning()) {
        <p class="warning" role="alert">{{ warning() }}</p>
      }
      @if (saveError()) {
        <p class="error" role="alert">{{ saveError() }}</p>
      }

      <div class="actions">
        <button class="button" type="submit" [disabled]="form.invalid || saving()">
          @if (saving()) {
            Saving...
          } @else {
            Save changes
          }
        </button>
        <button class="button ghost" type="button" (click)="cancelEdit()" [disabled]="saving()">
          Cancel
        </button>
        <button class="button danger" type="button" (click)="removeIncident()" [disabled]="saving()">
          Delete
        </button>
      </div>
    </form>
  `,
  styles: [
    `
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
      .helper {
        margin: 0 0 var(--space-2, 0.5rem);
        color: var(--color-text-muted, #64748b);
      }
      .form {
        margin: var(--space-4, 1rem) 0;
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
      .button.ghost {
        background: transparent;
        color: var(--color-primary, #0c4a6e);
      }
      .button.danger {
        background: #b91c1c;
        color: #fff;
      }
      .button[disabled] {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .error {
        margin: 0 0 var(--space-3, 0.75rem);
        color: #b91c1c;
        font-weight: 600;
      }
      .warning {
        margin: 0 0 var(--space-3, 0.75rem);
        color: #b45309;
        font-weight: 600;
      }
    `
  ]
})
export class IncidentEditFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly incidents = inject(BehaviorIncidentService);

  readonly incident = input.required<BehaviorIncident>();
  readonly cancel = output();
  readonly saved = output<BehaviorIncident>();
  readonly remove = output();

  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly warning = signal<string | null>(null);
  readonly functionOptions = functionOptions;

  readonly form = this.fb.group({
    occurredAt: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    place: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    function: this.fb.nonNullable.control<BehaviorFunction | ''>('', { validators: [Validators.required] }),
    antecedent: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    behavior: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    consequence: this.fb.nonNullable.control('', { validators: [Validators.required] })
  });

  constructor() {
    effect(() => {
      const incident = this.incident();
      this.form.reset({
        occurredAt: toLocalDateInputValue(incident.occurredAtUtc),
        place: incident.place,
        function: incident.function,
        antecedent: incident.antecedent,
        behavior: incident.behavior,
        consequence: incident.consequence
      }, { emitEvent: false });

      const occurredAt = new Date(incident.occurredAtUtc).getTime();
      const ageDays = (Date.now() - occurredAt) / (1000 * 60 * 60 * 24);
      if (ageDays > 30) {
        this.warning.set('You are editing an older incident. Please confirm the details carefully.');
      } else {
        this.warning.set(null);
      }
    });
  }

  cancelEdit() {
    this.cancel.emit();
  }

  removeIncident() {
    this.remove.emit();
  }

  save() {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const incident = this.incident();
    const occurredAtUtc = toUtcIsoString(this.form.controls.occurredAt.value);

    const payload: UpdateBehaviorIncidentRequest = {
      occurredAtUtc,
      place: this.form.controls.place.value.trim(),
      function: this.form.controls.function.value as BehaviorFunction,
      antecedent: this.form.controls.antecedent.value.trim(),
      behavior: this.form.controls.behavior.value.trim(),
      consequence: this.form.controls.consequence.value.trim()
    };

    this.saving.set(true);
    this.saveError.set(null);

    this.incidents
      .updateIncident(incident.participantId, incident.id, payload)
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.saved.emit(updated);
        },
        error: () => {
          this.saveError.set('Unable to update incident.');
          this.saving.set(false);
        }
      });
  }
}
