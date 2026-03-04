/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/919aa436c7d64f83a4bebc477716b80f
 * @stitch-screen projects/2002730124455423542/screens/54d6edcd1f714ff28f043774207342b3
 * @stitch-screen projects/2002730124455423542/screens/8a3feec5c2eb4cfda8f978bb655dfae4
 * @stitch-screen projects/2002730124455423542/screens/84181104f7ef428c896d71e697b01da6
 * @stitch-screen-title Participant Setup
 * @stitch-status converted
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MedicationFrequency } from '../../shared/models/medication';
import { AuthService } from '../../shared/services/auth.service';
import { MedicationService } from '../../shared/services/medication.service';
import { ParticipantService } from '../../shared/services/participant.service';

type Step = 'welcome' | 'form' | 'medication' | 'success';

type AddedMedication = { id: string; name: string; dosageText: string; frequency: MedicationFrequency };

const FREQUENCY_LABELS: Record<MedicationFrequency, string> = {
  'once-daily': 'Once daily',
  'twice-daily': 'Twice daily',
  'three-times-daily': 'Three times daily',
  'interval-days': 'Interval',
  'as-needed': 'As needed',
};

@Component({
  selector: 'app-participant-setup',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @switch (step()) {
        @case ('welcome') {
          <div class="container">
            <header class="header">
              <svg class="logo-svg" fill="none" height="64" viewBox="0 0 64 64" width="64" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 40C12 40 18 32 24 32C30 32 36 40 42 40C48 40 54 32 54 32" stroke="#d1d5db" stroke-linecap="round" stroke-width="4"/>
                <path d="M12 30C12 30 18 22 24 22C30 22 36 30 42 30C48 30 54 22 54 22" stroke="#d1d5db" stroke-linecap="round" stroke-width="4"/>
                <path d="M12 20C12 20 18 12 24 12C30 12 36 20 42 20C48 20 54 12 54 12" stroke="#d1d5db" stroke-linecap="round" stroke-width="4"/>
              </svg>
              <span class="step-hint">3 steps to get started</span>
              <h1 class="logo-title">TrackIt</h1>
              <p class="subtitle">Your family's wellness journey, all in one place.</p>
            </header>
            <div class="card">
              <h2 class="card-heading">Welcome! Let's get you set up.</h2>
              <p class="card-body">It only takes a few minutes to create your profile and add your first participant — then you'll be ready to start tracking.</p>
            </div>
            <div class="actions">
              <button class="btn-primary" type="button" (click)="startSetup()">Set Up Your Profile →</button>
              <button class="btn-link" type="button" (click)="signOut()">Sign out</button>
            </div>
          </div>
        }
        @case ('form') {
          <div class="container">
            <div class="logo-section">
              <svg class="logo-svg" fill="none" height="64" viewBox="0 0 64 64" width="64" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 20C12 20 18 12 24 12C30 12 36 20 42 20C48 20 54 12 54 12" stroke="#10b981" stroke-linecap="round" stroke-width="4"/>
                <path d="M12 30C12 30 18 22 24 22C30 22 36 30 42 30C48 30 54 22 54 22" stroke="#d1d5db" stroke-linecap="round" stroke-width="4"/>
                <path d="M12 40C12 40 18 32 24 32C30 32 36 40 42 40C48 40 54 32 54 32" stroke="#d1d5db" stroke-linecap="round" stroke-width="4"/>
              </svg>
              <span class="step-hint">Step 1 of 3</span>
              <h1 class="logo-title">TrackIt</h1>
            </div>
            <div class="form-heading">
              <h2 class="form-title">Who are you tracking?</h2>
              <p class="form-subtitle">Tell us a little about the person you'll be supporting.</p>
            </div>
            <form [formGroup]="form" (ngSubmit)="submit()" class="card form-card">
              <div class="field">
                <label class="field-label" for="displayName">First Name</label>
                <input id="displayName" class="field-input" type="text" placeholder="Enter first name" formControlName="displayName">
              </div>
              <div class="field last">
                <label class="field-label" for="birthDate">Date of Birth</label>
                <input id="birthDate" class="field-input" type="date" formControlName="birthDate">
              </div>
            </form>
            @if (errorMessage()) {
              <p class="error-message" role="alert">{{ errorMessage() }}</p>
            }
            <div class="actions">
              <button class="btn-primary" type="button" (click)="submit()" [disabled]="saving()">
                @if (saving()) { Adding… } @else { Add Participant → }
              </button>
              <button class="btn-link" type="button" (click)="step.set('welcome')">← Back</button>
            </div>
          </div>
        }
        @case ('medication') {
          <div class="container">
            <div class="logo-section">
              <svg class="logo-svg" fill="none" height="64" viewBox="0 0 64 64" width="64" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 20C12 20 18 12 24 12C30 12 36 20 42 20C48 20 54 12 54 12" stroke="#10b981" stroke-linecap="round" stroke-width="4"/>
                <path d="M12 30C12 30 18 22 24 22C30 22 36 30 42 30C48 30 54 22 54 22" stroke="#8b5cf6" stroke-linecap="round" stroke-width="4"/>
                <path d="M12 40C12 40 18 32 24 32C30 32 36 40 42 40C48 40 54 32 54 32" stroke="#d1d5db" stroke-linecap="round" stroke-width="4"/>
              </svg>
              <span class="step-hint">Step 2 of 3</span>
              <h1 class="logo-title">TrackIt</h1>
            </div>
            <div class="form-heading">
              <h2 class="form-title">Any medications to track?</h2>
              <p class="form-subtitle">Add a medication your participant takes regularly. You can add more later.</p>
            </div>
            @if (addedMedications().length > 0) {
              <ul class="med-list">
                @for (med of addedMedications(); track med.id) {
                  <li class="med-item">
                    <span class="med-label">{{ med.name }} — {{ med.dosageText }} — {{ freqLabel(med.frequency) }}</span>
                    <button class="med-remove" type="button" (click)="removeMedication(med.id)" aria-label="Remove {{ med.name }}">✕</button>
                  </li>
                }
              </ul>
            }
            <form [formGroup]="medForm" (ngSubmit)="addMedication()" class="card form-card">
              <div class="field">
                <label class="field-label" for="medName">Medication Name</label>
                <input id="medName" class="field-input" type="text" placeholder="e.g., Albuterol" formControlName="name">
              </div>
              <div class="field">
                <label class="field-label" for="dosageText">Dosage</label>
                <input id="dosageText" class="field-input" type="text" placeholder="e.g., 5mg" formControlName="dosageText">
              </div>
              <div class="field">
                <label class="field-label" for="frequency">Frequency</label>
                <select id="frequency" class="field-input field-select" formControlName="frequency">
                  <option value="once-daily">Once daily</option>
                  <option value="twice-daily">Twice daily</option>
                  <option value="three-times-daily">Three times daily</option>
                  <option value="as-needed">As needed</option>
                </select>
              </div>
              <div class="field last">
                <label class="field-label" for="notes">Notes</label>
                <textarea id="notes" class="field-input field-textarea" placeholder="Special instructions…" rows="2" formControlName="notes"></textarea>
              </div>
            </form>
            @if (medErrorMessage()) {
              <p class="error-message" role="alert">{{ medErrorMessage() }}</p>
            }
            <button class="btn-outline" type="button" (click)="addMedication()" [disabled]="addingMed()">
              @if (addingMed()) { Adding… } @else { Add Medication + }
            </button>
            <div class="actions med-actions">
              <button class="btn-primary" type="button" (click)="step.set('success')">Continue →</button>
              <button class="btn-muted" type="button" (click)="step.set('success')">Skip for now</button>
              <button class="btn-link" type="button" (click)="step.set('form')">← Back</button>
            </div>
          </div>
        }
        @case ('success') {
          <div class="container">
            <div class="logo-section">
              <svg class="logo-svg" fill="none" height="64" viewBox="0 0 64 64" width="64" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 18C12 18 20 8 32 8C44 8 52 18 60 18" stroke="#10b981" stroke-linecap="round" stroke-width="6"/>
                <path d="M4 32C12 32 20 22 32 22C44 22 52 32 60 32" stroke="#8b5cf6" stroke-linecap="round" stroke-width="6"/>
                <path d="M4 46C12 46 20 36 32 36C44 36 52 46 60 46" stroke="#f59e0b" stroke-linecap="round" stroke-width="6"/>
              </svg>
              <h1 class="logo-title">TrackIt</h1>
            </div>
            <div class="card success-card">
              <div class="success-icon-wrap" aria-hidden="true">✨</div>
              <h2 class="card-heading">You're all set!</h2>
              <p class="card-body">{{ createdName() }} is ready to track. You can adjust settings any time from your profile.</p>
            </div>
            <div class="pill-row">
              <div class="pill">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>{{ createdName() }}</span>
              </div>
              @if (addedMedications().length > 0) {
                <div class="pill">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                  </svg>
                  <span>{{ addedMedications().length }} {{ addedMedications().length === 1 ? 'medication' : 'medications' }}</span>
                </div>
              }
            </div>
            <div class="actions">
              <button class="btn-primary" type="button" (click)="goToDashboard()">Go to Dashboard →</button>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .page {
      min-height: 100dvh;
      background: #fcfcfd;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', system-ui, sans-serif;
      color: #1e293b;
      padding: 1.5rem;
    }

    .container {
      width: 100%;
      max-width: 390px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 0;
    }

    .header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 2.5rem;
    }

    .logo-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 2.5rem;
    }

    .logo-svg {
      display: block;
      margin-bottom: 0.25rem;
    }

    .step-hint {
      font-size: 0.6875rem;
      color: #9ca3af;
      font-weight: 500;
      margin-top: 0.25rem;
      margin-bottom: 0.75rem;
    }

    .logo-title {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin: 0 0 0.5rem;
    }

    .subtitle {
      font-size: 0.875rem;
      color: #64748b;
      max-width: 240px;
      line-height: 1.6;
      margin: 0;
    }

    .card {
      background: #fff;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.05);
      width: 100%;
      margin-bottom: 2rem;
      box-sizing: border-box;
    }

    .card-heading {
      font-size: 1.375rem;
      font-weight: 700;
      line-height: 1.3;
      margin: 0 0 1rem;
    }

    .card-body {
      color: #64748b;
      line-height: 1.65;
      margin: 0;
    }

    .form-heading {
      width: 100%;
      margin-bottom: 2rem;
    }

    .form-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 0 0.5rem;
    }

    .form-subtitle {
      font-size: 0.875rem;
      color: #64748b;
      margin: 0;
    }

    .form-card {
      margin-bottom: 1rem;
    }

    .field {
      margin-bottom: 1.25rem;
    }

    .field.last {
      margin-bottom: 0;
    }

    .field-label {
      display: block;
      font-size: 0.6875rem;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .field-input {
      width: 100%;
      padding: 0.75rem 1rem;
      background: #f9fafb;
      border: none;
      border-radius: 8px;
      font-size: 0.9375rem;
      color: #1e293b;
      outline: none;
      box-sizing: border-box;
      font-family: inherit;
    }

    .field-input:focus {
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
    }

    .field-input::placeholder {
      color: #9ca3af;
    }

    .field-select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      background-size: 1.25em 1.25em;
      padding-right: 2.5rem;
    }

    .field-textarea {
      resize: none;
    }

    .error-message {
      color: #b91c1c;
      font-size: 0.875rem;
      font-weight: 500;
      margin: 0 0 1rem;
      width: 100%;
    }

    /* Added medications list */
    .med-list {
      list-style: none;
      margin: 0 0 1rem;
      padding: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .med-item {
      background: #fff;
      border: 1px solid #f1f5f9;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
    }

    .med-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #1e293b;
    }

    .med-remove {
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 0.75rem;
      cursor: pointer;
      padding: 0.25rem;
      line-height: 1;
      font-family: inherit;
    }

    .med-remove:hover {
      color: #64748b;
    }

    /* Success card */
    .success-card {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .success-icon-wrap {
      font-size: 1.25rem;
      width: 2.5rem;
      height: 2.5rem;
      background: rgba(16, 185, 129, 0.1);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.5rem;
    }

    .pill-row {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .pill {
      background: #fff;
      padding: 0.625rem 1rem;
      border-radius: 9999px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
      border: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #1e293b;
    }

    .pill svg {
      color: #9ca3af;
    }

    /* Buttons */
    .actions {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }

    .med-actions {
      margin-top: 1.5rem;
    }

    .btn-primary {
      width: 100%;
      height: 52px;
      background: #10b981;
      color: #fff;
      font-weight: 700;
      font-size: 1rem;
      border: none;
      border-radius: 9999px;
      cursor: pointer;
      transition: opacity 0.15s;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      font-family: inherit;
    }

    .btn-primary:hover:not(:disabled) {
      opacity: 0.9;
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-outline {
      width: 100%;
      height: 48px;
      background: #fff;
      color: #10b981;
      font-weight: 700;
      font-size: 0.9375rem;
      border: 2px solid #10b981;
      border-radius: 9999px;
      cursor: pointer;
      transition: opacity 0.15s;
      font-family: inherit;
    }

    .btn-outline:hover:not(:disabled) {
      opacity: 0.85;
    }

    .btn-outline:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-muted {
      background: none;
      border: none;
      color: #9ca3af;
      font-weight: 500;
      font-size: 0.9375rem;
      cursor: pointer;
      padding: 0;
      font-family: inherit;
    }

    .btn-muted:hover {
      color: #64748b;
    }

    .btn-link {
      background: none;
      border: none;
      color: #137fec;
      font-weight: 500;
      font-size: 0.875rem;
      cursor: pointer;
      padding: 0;
      font-family: inherit;
    }

    .btn-link:hover {
      text-decoration: underline;
    }
  `]
})
export class ParticipantSetupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly participantService = inject(ParticipantService);
  private readonly medicationService = inject(MedicationService);
  private readonly authService = inject(AuthService);

  readonly step = signal<Step>('welcome');
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly createdName = signal<string | null>(null);
  readonly addedMedications = signal<AddedMedication[]>([]);
  readonly addingMed = signal(false);
  readonly medErrorMessage = signal<string | null>(null);

  readonly form = this.fb.group({
    displayName: this.fb.nonNullable.control(''),
    birthDate: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)
    ])
  });

  readonly medForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    dosageText: this.fb.nonNullable.control('', [Validators.required]),
    frequency: this.fb.nonNullable.control<MedicationFrequency>('once-daily'),
    notes: this.fb.nonNullable.control('')
  });

  freqLabel(freq: MedicationFrequency): string {
    return FREQUENCY_LABELS[freq];
  }

  startSetup(): void {
    this.step.set('form');
  }

  signOut(): void {
    this.authService.logout();
  }

  submit(): void {
    if (this.saving() || this.form.invalid) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    const { displayName, birthDate } = this.form.getRawValue();
    this.participantService.createParticipant({
      ...(displayName && { displayName }),
      birthDate
    }).subscribe({
      next: (participant) => {
        this.participantService.setActiveParticipant(participant.id);
        this.createdName.set(displayName || 'Your participant');
        this.step.set('medication');
        this.saving.set(false);
      },
      error: (err) => {
        const message = err?.error?.message;
        this.errorMessage.set(message || 'Something went wrong. Please try again.');
        this.saving.set(false);
      }
    });
  }

  addMedication(): void {
    if (this.addingMed() || this.medForm.invalid) return;
    const participantId = this.participantService.activeParticipantId();
    if (!participantId) return;
    this.addingMed.set(true);
    this.medErrorMessage.set(null);
    const { name, dosageText, frequency, notes } = this.medForm.getRawValue();
    this.medicationService.createMedication(participantId, {
      name,
      dosageText,
      frequency,
      startDateUtc: new Date().toISOString().split('T')[0],
      ...(notes && { notes })
    }).subscribe({
      next: (med) => {
        this.addedMedications.update(list => [...list, { id: med.id, name: med.name, dosageText: med.dosageText, frequency: med.frequency }]);
        this.medForm.reset({ frequency: 'once-daily' });
        this.addingMed.set(false);
      },
      error: (err) => {
        const message = err?.error?.message;
        this.medErrorMessage.set(message || 'Could not add medication. Please try again.');
        this.addingMed.set(false);
      }
    });
  }

  removeMedication(id: string): void {
    const participantId = this.participantService.activeParticipantId();
    if (!participantId) return;
    this.medicationService.updateMedication(participantId, id, {
      archivedAtUtc: new Date().toISOString()
    }).subscribe({
      next: () => this.addedMedications.update(list => list.filter(m => m.id !== id))
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/insights']);
  }
}
