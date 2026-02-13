import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card.component';
import { CreateParticipantRequest, ParticipantService } from '../../shared/services/participant.service';

@Component({
  selector: 'app-participant-create',
  imports: [ReactiveFormsModule, RouterLink, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card class="card">
      @if (created()) {
        <h2>Participant created</h2>
        <p class="muted">
          You're all set. Jump to Activity or review your participants.
        </p>
        <div class="actions">
          <a class="button" routerLink="/home">Go to Activity</a>
          <a class="button secondary" routerLink="/participants">View participants</a>
        </div>
      } @else {
        <h2>Create a participant</h2>
        <p class="muted">
          Add a short name and birth date so TrackIt can organize the data you capture.
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

          <label for="birthDate">Birth date</label>
          <input
            id="birthDate"
            type="date"
            formControlName="birthDate"
            [attr.aria-invalid]="birthDateInvalid()"
            [attr.aria-describedby]="birthDateInvalid() ? 'birth-date-error' : null"
          />
          @if (birthDateInvalid()) {
            <p id="birth-date-error" class="error" role="alert">
              Enter a valid birth date.
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
      .button.secondary {
        background: #fff;
        color: var(--color-primary, #0c4a6e);
        border: 1px solid var(--color-primary, #0c4a6e);
      }
      .actions {
        display: flex;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
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
    birthDate: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]
    })
  });

  birthDateInvalid() {
    const control = this.form.controls.birthDate;
    return control.invalid && (control.dirty || control.touched);
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const birthDate = this.form.controls.birthDate.value.trim();
    if (!birthDate) {
      this.form.controls.birthDate.setErrors({ required: true });
      return;
    }

    const displayName = this.form.controls.displayName.value.trim();
    const payload: CreateParticipantRequest = {
      birthDate,
      ...(displayName ? { displayName } : {})
    };

    this.saving.set(true);
    this.error.set(null);

    this.participants.createParticipant(payload).subscribe({
      next: (created) => {
        this.participants.setActiveParticipant(created.id);
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
