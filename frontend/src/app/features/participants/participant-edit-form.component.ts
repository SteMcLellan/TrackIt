import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Participant } from '../../shared/models/participant';
import { ParticipantService } from '../../shared/services/participant.service';

@Component({
  selector: 'app-participant-edit-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="form" [formGroup]="form" (ngSubmit)="save()">
      <label for="displayName">Display name</label>
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
      input {
        width: 100%;
        padding: 0.6rem 0.75rem;
        border-radius: var(--radius-2, 0.5rem);
        border: 1px solid #cbd5f5;
        margin-bottom: var(--space-3, 0.75rem);
        font-size: 1rem;
      }
      .error {
        margin: 0 0 var(--space-3, 0.75rem);
        color: #b91c1c;
        font-weight: 600;
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
      .button[disabled] {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `
  ]
})
export class ParticipantEditFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly participantsService = inject(ParticipantService);

  readonly participant = input.required<Participant>();
  readonly cancel = output();
  readonly saved = output<Participant>();

  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly form = this.fb.group({
    displayName: this.fb.nonNullable.control(''),
    birthDate: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]
    })
  });

  constructor() {
    effect(() => {
      const participant = this.participant();
      this.form.reset({
        displayName: participant.displayName ?? '',
        birthDate: participant.birthDate ?? ''
      }, { emitEvent: false });
    });
  }

  birthDateInvalid() {
    const control = this.form.controls.birthDate;
    return control.invalid && (control.dirty || control.touched);
  }

  cancelEdit() {
    this.cancel.emit();
  }

  save() {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const participant = this.participant();
    const displayName = this.form.controls.displayName.value.trim();
    const birthDate = this.form.controls.birthDate.value.trim();

    this.saving.set(true);
    this.saveError.set(null);

    this.participantsService
      .updateParticipant(participant.id, {
        displayName,
        birthDate: birthDate || undefined
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.saved.emit(updated);
        },
        error: () => {
          this.saveError.set('Unable to update participant.');
          this.saving.set(false);
        }
      });
  }
}
