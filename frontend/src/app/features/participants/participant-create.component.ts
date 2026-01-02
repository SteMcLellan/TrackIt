import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card/card.component';
import { CreateParticipantRequest, ParticipantService } from '../../shared/services/participant.service';

function integerValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as number | null;
    if (value === null || value === undefined) {
      return null;
    }
    return Number.isInteger(value) ? null : { integer: true };
  };
}

@Component({
  selector: 'app-participant-create',
  imports: [ReactiveFormsModule, RouterLink, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card class="card">
      @if (created()) {
        <h2>Participant created</h2>
        <p class="muted">
          You're all set. You can start tracking in your dashboard.
        </p>
        <a class="button" routerLink="/dashboard">Go to dashboard</a>
      } @else {
        <h2>Create a participant</h2>
        <p class="muted">
          Add a short name and age so TrackIt can organize the data you capture.
        </p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <label for="displayName">Display name (optional)</label>
          <input
            id="displayName"
            type="text"
            formControlName="displayName"
            autocomplete="off"
            placeholder="e.g., Avery"
          />

          <label for="ageYears">Age in years</label>
          <input
            id="ageYears"
            type="number"
            formControlName="ageYears"
            min="1"
            inputmode="numeric"
            [attr.aria-invalid]="ageInvalid()"
            [attr.aria-describedby]="ageInvalid() ? 'age-error' : null"
          />
          @if (ageInvalid()) {
            <p id="age-error" class="error" role="alert">
              Enter a whole number greater than zero.
            </p>
          }

          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }

          <button class="button" type="submit" [disabled]="form.invalid || saving()">
            @if (saving()) {
              Saving...
            } @else {
              Create participant
            }
          </button>
        </form>
      }
    </app-card>
  `,
  styles: [
    `
      .card {
        max-width: var(--layout-card-max, 32.5rem);
        margin: var(--space-6, 2rem) auto;
      }
      h2 {
        margin: 0 0 var(--space-2, 0.5rem);
      }
      label {
        display: block;
        margin: 0 0 var(--space-1, 0.25rem);
        font-weight: 600;
      }
      input {
        width: 100%;
        padding: 0.6rem 0.75rem;
        border-radius: var(--radius-2, 0.5rem);
        border: 1px solid #cbd5f5;
        margin-bottom: var(--space-3, 0.75rem);
        font-size: 1rem;
      }
      .muted {
        margin: 0 0 var(--space-4, 1rem);
        color: var(--color-text-muted, #64748b);
      }
      .error {
        margin: 0 0 var(--space-3, 0.75rem);
        color: #b91c1c;
        font-weight: 600;
      }
      .button {
        display: inline-block;
        background: var(--color-primary, #0c4a6e);
        color: #fff;
        padding: 0.6rem 1.2rem;
        border-radius: var(--radius-2, 0.5rem);
        text-decoration: none;
        font-weight: 600;
        border: none;
        cursor: pointer;
      }
      .button[disabled] {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `
  ]
})
export class ParticipantCreateComponent {
  private readonly participants = inject(ParticipantService);
  private readonly fb = inject(FormBuilder);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly created = signal(false);

  readonly form = this.fb.group({
    displayName: this.fb.nonNullable.control(''),
    ageYears: this.fb.control<number | null>(null, {
      validators: [Validators.required, Validators.min(1), integerValidator()]
    })
  });

  ageInvalid() {
    const control = this.form.controls.ageYears;
    return control.invalid && (control.dirty || control.touched);
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const ageYears = this.form.controls.ageYears.value;
    if (ageYears === null || ageYears === undefined) {
      this.form.controls.ageYears.setErrors({ required: true });
      return;
    }

    const displayName = this.form.controls.displayName.value.trim();
    const payload: CreateParticipantRequest = {
      ageYears,
      ...(displayName ? { displayName } : {})
    };

    this.saving.set(true);
    this.error.set(null);

    this.participants.createParticipant(payload).subscribe({
      next: () => {
        this.created.set(true);
        this.saving.set(false);
      },
      error: () => {
        this.error.set('Unable to create participant. Please try again.');
        this.saving.set(false);
      }
    });
  }
}
