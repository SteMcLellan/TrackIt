import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { CardComponent } from '../../shared/ui/card.component';
import { PageTitleComponent } from '../../shared/ui/page/page-title.component';
import { ParticipantService } from '../../shared/services/participant.service';
import { MedicationService } from '../../shared/services/medication.service';
import { Medication } from '../../shared/models/medication';
import { CollectionResponse } from '../../shared/models/collection';
import { environment } from '../../../environments/environment';

type MedicationsResponse = CollectionResponse<Medication>;

@Component({
  selector: 'app-medication-list',
  imports: [CardComponent, ReactiveFormsModule, PageTitleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <app-page-title
        title="Medication List"
        subtitle="Manage medications for the active participant"
      />

      <app-card class="card">
        @if (!activeParticipantId()) {
          <p class="error" role="alert">Select a participant to manage medications.</p>
        } @else {
          <form class="form" [formGroup]="medicationForm" (ngSubmit)="submitForm()">
            <h3>{{ formTitle() }}</h3>
            <div class="grid">
              <div class="field">
                <label for="name">Medication name <span class="required">*</span></label>
                <input
                  id="name"
                  type="text"
                  formControlName="name"
                  autocomplete="off"
                  required
                  [attr.aria-invalid]="showError('name')"
                />
                @if (showError('name')) {
                  <p class="field-error" role="alert">Medication name is required.</p>
                }
              </div>
              <div class="field">
                <label for="dosageText">Dosage <span class="required">*</span></label>
                <input
                  id="dosageText"
                  type="text"
                  formControlName="dosageText"
                  required
                  [attr.aria-invalid]="showError('dosageText')"
                />
                @if (showError('dosageText')) {
                  <p class="field-error" role="alert">Dosage is required.</p>
                }
              </div>
              <div class="field">
                <label for="frequencyText">Frequency <span class="required">*</span></label>
                <select id="frequencyText" formControlName="frequencyText">
                  <option value="" disabled>Select a frequency</option>
                  @for (option of frequencyOptions; track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
                @if (showError('frequencyText')) {
                  <p class="field-error" role="alert">Frequency is required.</p>
                }
              </div>
              <div class="field">
                <label for="startDateUtc">Start date <span class="required">*</span></label>
                <input
                  id="startDateUtc"
                  type="date"
                  formControlName="startDateUtc"
                  required
                  [attr.aria-invalid]="showError('startDateUtc')"
                />
                @if (showError('startDateUtc')) {
                  <p class="field-error" role="alert">Start date is required.</p>
                }
              </div>
              <div class="field">
                <label for="endDateUtc">End date (optional)</label>
                <input id="endDateUtc" type="date" formControlName="endDateUtc" />
              </div>
              <div class="field full">
                <label for="notes">Notes (optional)</label>
                <textarea id="notes" rows="2" formControlName="notes"></textarea>
              </div>
            </div>
            <div class="actions">
              <button
                class="button"
                type="submit"
                [disabled]="!canSubmit()"
                [attr.aria-disabled]="!canSubmit()"
              >
                {{ formCta() }}
              </button>
              @if (isEditing()) {
                <button class="button secondary" type="button" (click)="cancelEdit()">Cancel</button>
              } @else {
                <button class="button secondary" type="button" (click)="resetForm()">Clear</button>
              }
            </div>
            @if (formError()) {
              <p class="error" role="alert">{{ formError() }}</p>
            }
          </form>
        }
      </app-card>

      <app-card class="card">
        <div class="header-row">
          <div class="header">
            <h2>Active medications</h2>
            <p class="muted">Archived medications are hidden by default.</p>
          </div>
          <label class="toggle">
            <input type="checkbox" [checked]="includeArchived()" (change)="toggleArchived($event)" />
            <span>Show archived</span>
          </label>
        </div>

        @if (!activeParticipantId()) {
          <p class="error" role="alert">Select a participant to view medications.</p>
        } @else if (medicationsResource.isLoading()) {
          <p class="muted">Loading medications...</p>
        } @else if (medicationsResource.error()) {
          <p class="error" role="alert">Unable to load medications.</p>
        } @else if (activeMedications().length === 0) {
          <p class="muted">No active medications yet.</p>
        } @else {
          <ul class="list" role="list">
            @for (medication of activeMedications(); track medication.id) {
              <li class="item">
                <div class="item-main">
                  <div class="title">{{ medication.name }}</div>
                  <div class="meta">
                    <span>{{ medication.dosageText }}</span>
                    <span class="dot">·</span>
                    <span>{{ frequencyLabel(medication.frequencyText) }}</span>
                  </div>
                  <div class="meta">
                    <span>Start {{ medication.startDateUtc }}</span>
                    @if (medication.endDateUtc) {
                      <span class="dot">·</span>
                      <span>End {{ medication.endDateUtc }}</span>
                    }
                  </div>
                  @if (medication.notes) {
                    <p class="notes">{{ medication.notes }}</p>
                  }
                </div>
                <div class="item-actions">
                  <button class="link" type="button" (click)="editMedication(medication)">Edit</button>
                  <button class="link" type="button" (click)="archiveMedication(medication)">Archive</button>
                </div>
              </li>
            }
          </ul>
        }
      </app-card>

      @if (includeArchived() && archivedMedications().length > 0) {
        <app-card class="card">
          <div class="header">
            <h2>Archived medications</h2>
            <p class="muted">Restore to move back into the active list.</p>
          </div>
          <ul class="list" role="list">
            @for (medication of archivedMedications(); track medication.id) {
              <li class="item archived">
                <div class="item-main">
                  <div class="title">{{ medication.name }}</div>
                  <div class="meta">
                    <span>{{ medication.dosageText }}</span>
                    <span class="dot">·</span>
                    <span>{{ frequencyLabel(medication.frequencyText) }}</span>
                  </div>
                </div>
                <div class="item-actions">
                  <button class="link" type="button" (click)="restoreMedication(medication)">Restore</button>
                </div>
              </li>
            }
          </ul>
        </app-card>
      }
    </div>
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
      .header {
        display: grid;
        gap: var(--space-1, 0.25rem);
        margin-bottom: var(--space-4, 1rem);
      }
      .header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
        margin-bottom: var(--space-4, 1rem);
      }
      .header-row .header {
        margin-bottom: 0;
      }
      h2 {
        margin: 0;
        font-size: var(--font-size-lg, 1.125rem);
        font-weight: 600;
      }
      h3 {
        margin: 0 0 var(--space-3, 0.75rem);
        font-size: 1.1rem;
      }
      .muted {
        margin: 0;
        color: var(--color-text-muted, #64748b);
        font-size: var(--font-size-sm, 0.8125rem);
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-primary, #0c4a6e);
        color: #fff;
        padding: 0.6rem 1rem;
        min-height: 44px;
        border-radius: var(--radius-full, 999px);
        text-decoration: none;
        font-weight: 600;
        font-size: var(--font-size-sm, 0.8125rem);
        border: none;
        cursor: pointer;
        transition: transform var(--transition-fast, 120ms ease), box-shadow var(--transition-fast, 120ms ease);
      }
      .button:hover:not([disabled]) {
        box-shadow: 0 2px 8px rgba(12, 74, 110, 0.25);
      }
      .button:active:not([disabled]) {
        transform: scale(0.97);
      }
      .button[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
        box-shadow: none;
      }
      .button.secondary {
        background: #fff;
        color: var(--color-primary, #0c4a6e);
        border: 1px solid var(--color-border, #e2e8f0);
      }
      .button.secondary:hover:not([disabled]) {
        border-color: var(--color-primary, #0c4a6e);
        box-shadow: none;
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
      }
      .form {
        display: grid;
        gap: var(--space-4, 1rem);
      }
      .grid {
        display: grid;
        gap: var(--space-4, 1rem);
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .field {
        min-width: 0;
      }
      .field label {
        display: block;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }
      .required {
        color: #b91c1c;
      }
      .field input,
      .field textarea,
      .field select {
        width: 100%;
        padding: 0.55rem 0.6rem;
        border-radius: var(--radius-2, 0.5rem);
        border: 1px solid #cbd5f5;
        font-family: inherit;
        box-sizing: border-box;
      }
      .field-error {
        margin: 0.35rem 0 0;
        color: #b91c1c;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .field textarea {
        resize: vertical;
      }
      .field.full {
        grid-column: 1 / -1;
      }
      .actions {
        display: flex;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
      }
      .list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: var(--space-4, 1rem);
      }
      .item {
        border: 1px solid #e2e8f0;
        border-radius: var(--radius-2, 0.5rem);
        padding: var(--space-4, 1rem);
        background: #fff;
        display: flex;
        justify-content: space-between;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
      }
      .item.archived {
        background: #f8fafc;
      }
      .item-main {
        display: grid;
        gap: 0.45rem;
      }
      .title {
        font-weight: 700;
      }
      .meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--color-text-muted, #64748b);
        flex-wrap: wrap;
      }
      .notes {
        margin: 0.5rem 0 0;
        color: #1f2937;
      }
      .item-actions {
        display: flex;
        gap: 0.75rem;
        align-items: center;
      }
      .link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        color: var(--color-primary, #0c4a6e);
        font-weight: 600;
        cursor: pointer;
        padding: 0.5rem 0.75rem;
        min-height: 44px;
        border-radius: var(--radius-2, 0.5rem);
      }
      .dot {
        color: var(--color-text-muted, #94a3b8);
      }
      .error {
        margin: 0;
        color: #b91c1c;
        font-weight: 600;
      }
      @media (max-width: 520px) {
        .actions,
        .item-actions {
          width: 100%;
          flex-direction: column;
          align-items: stretch;
        }
        .actions .button,
        .item-actions .link {
          width: 100%;
        }
      }
    `
  ]
})
export class MedicationListComponent {
  private readonly participants = inject(ParticipantService);
  private readonly medicationsApi = inject(MedicationService);
  private readonly fb = inject(FormBuilder);

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly includeArchived = signal(false);
  private readonly refreshTick = signal(0);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly editingMedication = signal<Medication | null>(null);
  readonly attemptedSubmit = signal(false);

  readonly medicationForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    dosageText: this.fb.nonNullable.control('', [Validators.required]),
    frequencyText: this.fb.nonNullable.control('', [Validators.required]),
    startDateUtc: this.fb.nonNullable.control('', [Validators.required]),
    endDateUtc: this.fb.control<string | null>(''),
    notes: this.fb.control<string | null>('')
  });
  private readonly formStatus = toSignal(
    this.medicationForm.statusChanges.pipe(startWith(this.medicationForm.status)),
    { initialValue: this.medicationForm.status }
  );

  readonly medicationsResource = httpResource<MedicationsResponse>(() => {
    const participantId = this.activeParticipantId();
    const includeArchived = this.includeArchived();
    this.refreshTick();
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/medications`,
        method: 'GET',
        params: { pageSize: '1' }
      };
    }
    const params: Record<string, string> = { pageSize: '100' };
    if (includeArchived) {
      params['includeArchived'] = 'true';
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/medications`,
      method: 'GET',
      params
    };
  });

  readonly medications = computed(() =>
    this.medicationsResource.hasValue() ? this.medicationsResource.value().items : []
  );
  readonly activeMedications = computed(() => this.medications().filter((item) => !item.archivedAtUtc));
  readonly archivedMedications = computed(() => this.medications().filter((item) => item.archivedAtUtc));
  readonly isEditing = computed(() => !!this.editingMedication());
  readonly formTitle = computed(() => (this.isEditing() ? 'Edit medication' : 'Add medication'));
  readonly formCta = computed(() => (this.isEditing() ? 'Save changes' : 'Add medication'));
  readonly canSubmit = computed(() => this.formStatus() === 'VALID' && !this.saving());
  readonly frequencyOptions = [
    { value: 'once-daily', label: 'Once daily' },
    { value: 'twice-daily', label: 'Twice daily' },
    { value: 'three-times-daily', label: 'Three times daily' },
    { value: 'four-times-daily', label: 'Four times daily' },
    { value: 'every-other-day', label: 'Every other day' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'as-needed', label: 'As needed' }
  ] as const;
  private readonly frequencyLabelMap: Record<string, string> = Object.fromEntries(
    this.frequencyOptions.map((option) => [option.value, option.label])
  );

  frequencyLabel(value: string) {
    return this.frequencyLabelMap[value] ?? value;
  }

  submitForm() {
    this.attemptedSubmit.set(true);
    if (this.medicationForm.invalid || this.saving()) {
      return;
    }
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return;
    }

    const raw = this.medicationForm.getRawValue();
    const payload = {
      name: raw.name.trim(),
      dosageText: raw.dosageText.trim(),
      frequencyText: raw.frequencyText.trim(),
      startDateUtc: raw.startDateUtc,
      endDateUtc: raw.endDateUtc ? raw.endDateUtc : null,
      notes: raw.notes ? raw.notes.trim() : null
    };

    this.saving.set(true);
    this.formError.set(null);

    const editing = this.editingMedication();
    const request$ = editing
      ? this.medicationsApi.updateMedication(participantId, editing.id, payload)
      : this.medicationsApi.createMedication(participantId, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForm();
        this.refreshTick.update((value) => value + 1);
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Unable to save medication. Please try again.');
      }
    });
  }

  editMedication(medication: Medication) {
    this.editingMedication.set(medication);
    this.medicationForm.reset({
      name: medication.name,
      dosageText: medication.dosageText,
      frequencyText: medication.frequencyText,
      startDateUtc: medication.startDateUtc,
      endDateUtc: medication.endDateUtc ?? '',
      notes: medication.notes ?? ''
    });
  }

  cancelEdit() {
    this.resetForm();
  }

  resetForm() {
    this.editingMedication.set(null);
    this.attemptedSubmit.set(false);
    this.medicationForm.reset({
      name: '',
      dosageText: '',
      frequencyText: '',
      startDateUtc: '',
      endDateUtc: '',
      notes: ''
    });
  }

  archiveMedication(medication: Medication) {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return;
    }
    this.medicationsApi
      .updateMedication(participantId, medication.id, { archivedAtUtc: new Date().toISOString() })
      .subscribe({
        next: () => this.refreshTick.update((value) => value + 1),
        error: () => this.formError.set('Unable to archive medication. Please try again.')
      });
  }

  restoreMedication(medication: Medication) {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return;
    }
    this.medicationsApi.updateMedication(participantId, medication.id, { archivedAtUtc: null }).subscribe({
      next: () => this.refreshTick.update((value) => value + 1),
      error: () => this.formError.set('Unable to restore medication. Please try again.')
    });
  }

  toggleArchived(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.includeArchived.set(!!target?.checked);
  }

  showError(controlName: string) {
    const control = this.medicationForm.get(controlName);
    if (!control) {
      return false;
    }
    return control.invalid && (control.touched || this.attemptedSubmit());
  }
}
