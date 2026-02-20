import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { CollectionResponse } from '../../shared/models/collection';
import { Participant } from '../../shared/models/participant';
import { ActiveParticipantInviteResponse } from '../../shared/models/participant-invite';
import { ParticipantService } from '../../shared/services/participant.service';
import { BottomSheetComponent } from '../../shared/ui/page/bottom-sheet.component';

type MedicationFrequency = 'once-daily' | 'twice-daily' | 'three-times-daily' | 'interval-days' | 'as-needed';

type IntervalSchedule = {
  intervalDays: number;
  anchorDateLocal: string | null;
  anchorPolicy: 'reset-on-taken';
};

type MedicationRecord = {
  id: string;
  participantId: string;
  name: string;
  dosageText: string;
  frequency: MedicationFrequency;
  intervalSchedule?: IntervalSchedule | null;
  startDateUtc: string;
  endDateUtc: string | null;
  notes: string | null;
  archivedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/6a3a33ded32c4f688c10ff3f109a4623
 * @stitch-screen-title Profile Dashboard
 * @stitch-status converted
 * @stitch-last-sync 2026-02-12
 */
@Component({
  selector: 'app-profile-dashboard',
  imports: [ReactiveFormsModule, BottomSheetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <section class="title">
        <h1>Profile</h1>
        <p>Manage participant details, caregiver access, and medications.</p>
      </section>

      <section class="card participant">
        <div class="card-header">
          <h2>Participant Details</h2>
          @if (!participantEditMode() && participant()) {
            <button type="button" class="link-btn" (click)="beginParticipantEdit()">Edit</button>
          }
        </div>

        @if (participantResource.isLoading()) {
          <p class="muted">Loading participant details...</p>
        } @else if (participantResource.error()) {
          <p class="error">Unable to load participant details.</p>
        } @else if (participant(); as participant) {
          @if (!participantEditMode()) {
            <div class="grid">
              <div class="field full">
                <label>Child Name</label>
                <p>{{ participant.displayName || 'Not set' }}</p>
              </div>
              <div class="field">
                <label>Age</label>
                <p>{{ participant.ageYears ?? 'Not set' }}</p>
              </div>
              <div class="field">
                <label>Birthdate</label>
                <p>{{ birthDateLabel(participant.birthDate) }}</p>
              </div>
            </div>
          } @else {
            <form class="form" [formGroup]="participantForm" (ngSubmit)="saveParticipant()">
              <div class="field-group">
                <label for="participant-name">Child Name</label>
                <input id="participant-name" type="text" formControlName="displayName" />
              </div>
              <div class="field-group">
                <label for="participant-birthdate">Birthdate</label>
                <input id="participant-birthdate" type="date" formControlName="birthDate" />
              </div>
              <div class="actions">
                <button class="pill primary" type="submit" [disabled]="participantSaveDisabled()">
                  @if (participantSaving()) { Saving... } @else { Save }
                </button>
                <button class="pill ghost" type="button" (click)="cancelParticipantEdit()" [disabled]="participantSaving()">
                  Cancel
                </button>
              </div>
            </form>
          }
        } @else {
          <p class="muted">No active participant selected.</p>
        }

        @if (participantMessage()) {
          <p class="status" [class.error]="participantMessageIsError()">{{ participantMessage() }}</p>
        }
      </section>

      <section class="card caregiver">
        <div class="card-header">
          <h2>Caregiver Access</h2>
          <button class="regen-inline" type="button" (click)="regenerateInvite()" [disabled]="inviteBusy() || !canManageInvites()">
            <span class="material-symbols-outlined">refresh</span>
            @if (inviteBusy()) { Regenerating... } @else { Regenerate }
          </button>
        </div>

        @if (!canManageInvites()) {
          <p class="muted">Only managers can manage caregiver invites.</p>
        } @else if (activeInviteLink()) {
          <div class="invite-box">
            <p>{{ activeInviteLink() }}</p>
            @if (inviteExpiryLabel()) {
              <span>{{ inviteExpiryLabel() }}</span>
            }
          </div>
          <div class="actions">
            <button class="pill ghost-violet" type="button" (click)="copyInviteLink()">Copy</button>
            <button class="pill ghost-violet" type="button" (click)="shareInviteLink()">Share</button>
          </div>
        } @else if (activeInviteResource.isLoading()) {
          <p class="muted">Checking for active invite...</p>
        } @else {
          <p class="muted">No active invite. Generate one to share access.</p>
        }

        @if (inviteMessage()) {
          <p class="status" [class.error]="inviteMessageIsError()">{{ inviteMessage() }}</p>
        }
      </section>

      <section class="card meds">
        <div class="card-header">
          <h2>Medications</h2>
          <button type="button" class="add-inline" (click)="openMedicationSheet()">
            <span class="material-symbols-outlined">add</span>
            <span>Add</span>
          </button>
        </div>

        @if (medicationsResource.isLoading()) {
          <p class="muted">Loading medications...</p>
        } @else if (medicationsResource.error()) {
          <p class="error">Unable to load medications.</p>
        } @else if (activeMedications().length === 0) {
          <p class="muted">No active medications yet.</p>
        } @else {
          <div class="med-list">
            @for (medication of activeMedications(); track medication.id) {
              <article class="med-item">
                <div>
                  <p class="med-name">{{ medication.name }}</p>
                  <p class="med-meta">{{ medication.dosageText }} • {{ frequencyLabel(medication) }}</p>
                </div>
                <div class="med-actions">
                  <button class="text-btn" type="button" (click)="openMedicationSheet(medication)">Edit</button>
                  <button class="text-btn muted" type="button" (click)="archiveMedication(medication.id)"
                    [disabled]="archiveBusyId() === medication.id">
                    @if (archiveBusyId() === medication.id) { Archiving... } @else { Archive }
                  </button>
                </div>
              </article>
            }
          </div>
        }

        @if (medicationMessage()) {
          <p class="status" [class.error]="medicationMessageIsError()">{{ medicationMessage() }}</p>
        }
      </section>
    </div>

    <app-bottom-sheet
      [open]="medicationSheetOpen()"
      [title]="editingMedicationId() ? 'Edit Medication' : 'Add Medication'"
      (closed)="closeMedicationSheet()"
    >
      <form class="form" [formGroup]="medicationForm" (ngSubmit)="saveMedication()">
        <div class="field-group">
          <label for="med-name">Medication Name</label>
          <input id="med-name" type="text" formControlName="name" placeholder="e.g. Methylphenidate ER" />
        </div>
        <div class="field-group">
          <label for="med-dosage">Dosage</label>
          <input id="med-dosage" type="text" formControlName="dosageText" placeholder="e.g. 10mg" />
        </div>
        <div class="field-group">
          <label for="med-frequency">Frequency</label>
          <select id="med-frequency" formControlName="frequency">
            <option value="once-daily">Once daily</option>
            <option value="twice-daily">Twice daily</option>
            <option value="three-times-daily">Three times daily</option>
            <option value="interval-days">Every X days</option>
            <option value="as-needed">As needed</option>
          </select>
        </div>
        @if (isIntervalFrequency(medicationForm.controls.frequency.value)) {
          <div class="field-group">
            <label for="med-interval-days">Repeat every</label>
            <input id="med-interval-days" type="number" min="2" max="30" step="1" formControlName="intervalDays" />
            <p class="field-hint">Marking early or late resets the next due date.</p>
          </div>
        }
        <div class="field-group">
          <label for="med-notes">Notes / Instructions (Optional)</label>
          <textarea id="med-notes" formControlName="notes" rows="3"></textarea>
        </div>
        <button class="pill primary full" type="submit" [disabled]="medicationSaveDisabled()">
          @if (medicationSaving()) { Saving... } @else { Save }
        </button>
      </form>
    </app-bottom-sheet>
  `,
  styles: [`
    :host { display: block; width: 100%; max-width: 100%; }
    .page {
      width: 100%;
      max-width: 28rem;
      margin: 0 auto;
      padding: 1.5rem 1rem 11rem;
      display: grid;
      gap: 1rem;
      box-sizing: border-box;
      overflow-x: hidden;
      background: #fcfcfd;
    }
    h1 { margin: 0; color: #1e293b; font-size: 1.9rem; line-height: 1.1; }
    h2 { margin: 0; color: #1e293b; font-size: 1rem; }
    .title p { margin: 0.35rem 0 0; color: #64748b; font-size: 0.85rem; }
    .card {
      border-radius: 0.75rem;
      border: 1px solid #e2e8f0;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      padding: 1rem;
      display: grid;
      gap: 0.75rem;
    }
    .participant { background: #f0f9ff; border-color: rgba(14, 165, 233, 0.24); }
    .caregiver { background: #f5f3ff; border-color: rgba(139, 92, 246, 0.24); }
    .meds { background: #ecfdf5; border-color: rgba(16, 185, 129, 0.24); }
    .card-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
    .field.full { grid-column: 1 / -1; }
    .field label { display: block; margin-bottom: 0.2rem; color: #94a3b8; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .field p { margin: 0; color: #1e293b; font-weight: 600; }
    .form { display: grid; gap: 0.75rem; }
    .field-group { display: grid; gap: 0.3rem; }
    .field-group label { color: #94a3b8; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .field-hint { margin: 0; color: #64748b; font-size: 0.74rem; }
    input, select, textarea {
      width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 0.75rem 0.85rem;
      font: inherit;
      color: #1e293b;
      background: #fff;
    }
    input:focus-visible, select:focus-visible, textarea:focus-visible {
      outline: 2px solid #137fec;
      outline-offset: 1px;
      border-color: #137fec;
    }
    .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .pill {
      min-height: 44px;
      border-radius: 999px;
      border: 1px solid transparent;
      padding: 0.45rem 1rem;
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      cursor: pointer;
      background: #fff;
      color: #1e293b;
    }
    .pill.primary { background: #10b981; border-color: #10b981; color: #fff; }
    .pill.ghost { border-color: #7dd3fc; color: #0ea5e9; }
    .pill.violet { background: #8b5cf6; border-color: #8b5cf6; color: #fff; }
    .pill.ghost-violet { border-color: #c4b5fd; color: #8b5cf6; }
    .pill.full { width: 100%; }
    .pill:disabled, .link-btn:disabled, .text-btn:disabled, .regen-inline:disabled { opacity: 0.6; cursor: not-allowed; }
    .link-btn {
      min-height: 44px;
      border: 0;
      background: transparent;
      color: #137fec;
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      cursor: pointer;
      padding: 0;
    }
    .add-inline {
      min-height: 44px;
      border: 0;
      background: transparent;
      color: #10b981;
      font-size: 0.82rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      cursor: pointer;
      padding: 0;
    }
    .add-inline .material-symbols-outlined {
      font-size: 1rem;
      line-height: 1;
    }
    .regen-inline {
      min-height: 44px;
      border: 0;
      background: transparent;
      color: #8b5cf6;
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      cursor: pointer;
      padding: 0;
    }
    .regen-inline .material-symbols-outlined {
      font-size: 1rem;
      line-height: 1;
    }
    .invite-box {
      border: 1px dashed rgba(139, 92, 246, 0.4);
      border-radius: 0.75rem;
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.7);
    }
    .invite-box p { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #8b5cf6; font-size: 0.75rem; line-height: 1.35; word-break: break-all; }
    .invite-box span { display: inline-block; margin-top: 0.35rem; font-size: 0.72rem; color: #64748b; }
    .med-list { display: grid; gap: 0.6rem; }
    .med-item {
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 0.75rem;
      background: rgba(255, 255, 255, 0.7);
      padding: 0.7rem;
      display: grid;
      gap: 0.45rem;
    }
    .med-name { margin: 0; color: #1e293b; font-size: 0.9rem; font-weight: 700; }
    .med-meta { margin: 0.2rem 0 0; color: #64748b; font-size: 0.75rem; }
    .med-actions { display: flex; gap: 0.5rem; }
    .text-btn {
      min-height: 44px;
      border: 0;
      background: transparent;
      color: #10b981;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      cursor: pointer;
      padding: 0;
    }
    .text-btn.muted { color: #64748b; }
    .muted { margin: 0; color: #64748b; font-size: 0.8rem; }
    .status { margin: 0; color: #0f766e; font-size: 0.76rem; font-weight: 600; }
    .error { margin: 0; color: #b91c1c; font-size: 0.76rem; font-weight: 600; }
    @media (max-width: 360px) { .grid { grid-template-columns: 1fr; } }
  `]
})
export class ProfileDashboardComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly participantService = inject(ParticipantService);

  readonly participantRefresh = signal(0);
  readonly medicationsRefresh = signal(0);
  readonly invitesRefresh = signal(0);

  readonly participantEditMode = signal(false);
  readonly participantSaving = signal(false);
  readonly participantMessage = signal<string | null>(null);
  readonly participantMessageIsError = signal(false);

  readonly medicationSheetOpen = signal(false);
  readonly editingMedicationId = signal<string | null>(null);
  readonly medicationSaving = signal(false);
  readonly medicationMessage = signal<string | null>(null);
  readonly medicationMessageIsError = signal(false);
  readonly archiveBusyId = signal<string | null>(null);

  readonly inviteBusy = signal(false);
  readonly inviteMessage = signal<string | null>(null);
  readonly inviteMessageIsError = signal(false);

  readonly activeParticipantId = this.participantService.activeParticipantId;

  readonly participantForm = this.fb.group({
    displayName: this.fb.nonNullable.control(''),
    birthDate: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)])
  });

  readonly medicationForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required]),
    dosageText: this.fb.nonNullable.control('', [Validators.required]),
    frequency: this.fb.nonNullable.control<MedicationFrequency>('once-daily', [Validators.required]),
    intervalDays: this.fb.nonNullable.control(7, [Validators.min(2), Validators.max(30)]),
    notes: this.fb.nonNullable.control('')
  });

  readonly participantResource = httpResource<Participant>(() => {
    this.participantRefresh();
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return undefined;
    }
    return { url: `${environment.apiBaseUrl}/participants/${participantId}`, method: 'GET' };
  });

  readonly medicationsResource = httpResource<CollectionResponse<MedicationRecord>>(() => {
    this.medicationsRefresh();
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return undefined;
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/medications`,
      method: 'GET',
      params: { pageSize: '200' }
    };
  });

  readonly activeInviteResource = httpResource<ActiveParticipantInviteResponse>(() => {
    this.invitesRefresh();
    const participantId = this.activeParticipantId();
    const participant = this.participant();
    if (!participantId || participant?.role !== 'manager') {
      return undefined;
    }
    return { url: `${environment.apiBaseUrl}/participants/${participantId}/invites/active`, method: 'GET' };
  });

  readonly participant = computed(() => (this.participantResource.hasValue() ? this.participantResource.value() : null));
  readonly activeMedications = computed(() =>
    this.medicationsResource.hasValue() ? this.medicationsResource.value().items.filter((item) => !item.archivedAtUtc) : []
  );

  readonly activeInviteLink = computed(() => {
    if (!this.activeInviteResource.hasValue()) {
      return null;
    }
    const invite = this.activeInviteResource.value();
    if (!invite.inviteId) {
      return null;
    }
    return `${window.location.origin}/invite/${invite.participantId}/${invite.inviteId}`;
  });

  readonly inviteExpiryLabel = computed(() => {
    if (!this.activeInviteResource.hasValue() || !this.activeInviteResource.value().expiresAt) {
      return null;
    }
    const value = this.activeInviteResource.value().expiresAt!;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return `Expires ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsed)}`;
  });

  readonly canManageInvites = computed(() => this.participant()?.role === 'manager');

  constructor() {
    effect(() => {
      const participant = this.participant();
      if (!participant || this.participantEditMode()) {
        return;
      }
      this.participantForm.reset({
        displayName: participant.displayName ?? '',
        birthDate: participant.birthDate ?? ''
      }, { emitEvent: false });
    });
  }

  beginParticipantEdit(): void {
    const participant = this.participant();
    if (!participant) {
      return;
    }
    this.participantMessage.set(null);
    this.participantForm.reset({
      displayName: participant.displayName ?? '',
      birthDate: participant.birthDate ?? ''
    });
    this.participantEditMode.set(true);
  }

  cancelParticipantEdit(): void {
    this.participantEditMode.set(false);
  }

  saveParticipant(): void {
    if (this.participantSaveDisabled()) {
      this.participantForm.markAllAsTouched();
      return;
    }
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return;
    }

    this.participantSaving.set(true);
    this.participantService.updateParticipant(participantId, {
      displayName: this.toNullableString(this.participantForm.controls.displayName.value) ?? undefined,
      birthDate: this.participantForm.controls.birthDate.value
    }).subscribe({
      next: () => {
        this.participantSaving.set(false);
        this.participantEditMode.set(false);
        this.participantRefresh.update((value) => value + 1);
        this.setParticipantMessage('Participant saved.');
      },
      error: () => {
        this.participantSaving.set(false);
        this.setParticipantMessage('Unable to save participant.', true);
      }
    });
  }

  openMedicationSheet(medication?: MedicationRecord): void {
    if (medication) {
      this.editingMedicationId.set(medication.id);
      this.medicationForm.reset({
        name: medication.name,
        dosageText: medication.dosageText,
        frequency: medication.frequency,
        intervalDays: medication.intervalSchedule?.intervalDays ?? 7,
        notes: medication.notes ?? ''
      });
    } else {
      this.editingMedicationId.set(null);
      this.medicationForm.reset({ name: '', dosageText: '', frequency: 'once-daily', intervalDays: 7, notes: '' });
    }
    this.medicationSheetOpen.set(true);
  }

  closeMedicationSheet(): void {
    this.medicationSheetOpen.set(false);
    this.editingMedicationId.set(null);
  }

  saveMedication(): void {
    if (this.medicationSaveDisabled()) {
      this.medicationForm.markAllAsTouched();
      return;
    }
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return;
    }
    this.medicationSaving.set(true);

    const frequency = this.medicationForm.controls.frequency.value;
    const intervalDays = Number(this.medicationForm.controls.intervalDays.value);
    const payload: {
      name: string;
      dosageText: string;
      frequency: MedicationFrequency;
      intervalSchedule?: { intervalDays: number; anchorPolicy: 'reset-on-taken' };
      notes: string | null;
    } = {
      name: this.medicationForm.controls.name.value.trim(),
      dosageText: this.medicationForm.controls.dosageText.value.trim(),
      frequency,
      notes: this.toNullableString(this.medicationForm.controls.notes.value)
    };
    if (frequency === 'interval-days') {
      payload.intervalSchedule = {
        intervalDays,
        anchorPolicy: 'reset-on-taken'
      };
    }

    const medicationId = this.editingMedicationId();
    if (medicationId) {
      this.http.patch<MedicationRecord>(
        `${environment.apiBaseUrl}/participants/${participantId}/medications/${medicationId}`,
        payload
      ).subscribe({
        next: () => this.finishMedicationSave('Medication updated.'),
        error: () => this.failMedicationSave()
      });
      return;
    }

    this.http.post<MedicationRecord>(
      `${environment.apiBaseUrl}/participants/${participantId}/medications`,
      { ...payload, startDateUtc: this.localDateNow() }
    ).subscribe({
      next: () => this.finishMedicationSave('Medication added.'),
      error: () => this.failMedicationSave()
    });
  }

  archiveMedication(medicationId: string): void {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return;
    }
    this.archiveBusyId.set(medicationId);
    this.http.patch<MedicationRecord>(
      `${environment.apiBaseUrl}/participants/${participantId}/medications/${medicationId}`,
      { archivedAtUtc: new Date().toISOString() }
    ).subscribe({
      next: () => {
        this.archiveBusyId.set(null);
        this.medicationsRefresh.update((value) => value + 1);
        this.setMedicationMessage('Medication archived.');
      },
      error: () => {
        this.archiveBusyId.set(null);
        this.setMedicationMessage('Unable to archive medication.', true);
      }
    });
  }

  regenerateInvite(): void {
    const participantId = this.activeParticipantId();
    if (!participantId || !this.canManageInvites()) {
      return;
    }
    this.inviteBusy.set(true);
    this.http.post<{ participantId: string; inviteId: string; expiresAt: string }>(
      `${environment.apiBaseUrl}/participants/${participantId}/invites`,
      {}
    ).subscribe({
      next: () => {
        this.inviteBusy.set(false);
        this.invitesRefresh.update((value) => value + 1);
        this.setInviteMessage('Invite regenerated.');
      },
      error: () => {
        this.inviteBusy.set(false);
        this.setInviteMessage('Unable to regenerate invite.', true);
      }
    });
  }

  copyInviteLink(): void {
    const link = this.activeInviteLink();
    if (!link) {
      return;
    }
    void this.copyToClipboard(link);
  }

  async shareInviteLink(): Promise<void> {
    const link = this.activeInviteLink();
    if (!link) {
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TrackIt caregiver invite',
          text: 'Join me in TrackIt.',
          url: link
        });
        this.setInviteMessage('Invite shared.');
        return;
      } catch {
        // fallback to clipboard below
      }
    }
    await this.copyToClipboard(link);
  }

  birthDateLabel(value?: string): string {
    if (!value) {
      return 'Not set';
    }
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsed);
  }

  frequencyLabel(medication: MedicationRecord): string {
    if (medication.frequency === 'once-daily') return 'Once daily';
    if (medication.frequency === 'twice-daily') return 'Twice daily';
    if (medication.frequency === 'three-times-daily') return 'Three times daily';
    if (medication.frequency === 'interval-days') {
      return `Every ${medication.intervalSchedule?.intervalDays ?? 7} days`;
    }
    return 'As needed';
  }

  isIntervalFrequency(value: MedicationFrequency): boolean {
    return value === 'interval-days';
  }

  participantSaveDisabled(): boolean {
    return this.participantSaving() || this.participantForm.invalid || !this.participantForm.dirty;
  }

  medicationSaveDisabled(): boolean {
    if (this.medicationSaving()) {
      return true;
    }
    if (
      this.medicationForm.controls.name.invalid ||
      this.medicationForm.controls.dosageText.invalid ||
      this.medicationForm.controls.frequency.invalid
    ) {
      return true;
    }
    if (
      this.isIntervalFrequency(this.medicationForm.controls.frequency.value) &&
      this.medicationForm.controls.intervalDays.invalid
    ) {
      return true;
    }
    return false;
  }

  private finishMedicationSave(message: string): void {
    this.medicationSaving.set(false);
    this.medicationSheetOpen.set(false);
    this.editingMedicationId.set(null);
    this.medicationsRefresh.update((value) => value + 1);
    this.setMedicationMessage(message);
  }

  private failMedicationSave(): void {
    this.medicationSaving.set(false);
    this.setMedicationMessage('Unable to save medication.', true);
  }

  private localDateNow(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toNullableString(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async copyToClipboard(link: string): Promise<void> {
    if (!navigator.clipboard?.writeText) {
      this.setInviteMessage('Invite link ready to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      this.setInviteMessage('Invite copied to clipboard.');
    } catch {
      this.setInviteMessage('Unable to copy invite link.', true);
    }
  }

  private setParticipantMessage(message: string, isError = false): void {
    this.participantMessageIsError.set(isError);
    this.participantMessage.set(message);
  }

  private setMedicationMessage(message: string, isError = false): void {
    this.medicationMessageIsError.set(isError);
    this.medicationMessage.set(message);
  }

  private setInviteMessage(message: string, isError = false): void {
    this.inviteMessageIsError.set(isError);
    this.inviteMessage.set(message);
  }
}
