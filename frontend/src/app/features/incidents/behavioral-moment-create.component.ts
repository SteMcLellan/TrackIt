import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChipSelectorComponent } from '../../shared/ui/chip-selector.component';
import { ParticipantService } from '../../shared/services/participant.service';
import { BehaviorIncidentService } from '../../shared/services/behavior-incident.service';
import { BehaviorFunction } from '../../shared/models/behavior-incident';
import {
  antecedentChipCategories,
  behaviorChipCategories,
  consequenceChipCategories,
  placeChipOptions
} from '../../shared/models/incident-chip-options';
import {
  computeTzOffsetMinutes,
  extractLocalDate,
  extractLocalTime
} from '../../shared/utils/datetime';

type FunctionOption = {
  value: BehaviorFunction;
  label: string;
  icon: string;
};

const functionOptions: FunctionOption[] = [
  { value: 'sensory', label: 'Sensory', icon: 'psychology' },
  { value: 'tangible', label: 'Tangible', icon: 'shopping_basket' },
  { value: 'escape', label: 'Escape', icon: 'logout' },
  { value: 'attention', label: 'Attention', icon: 'groups' }
];

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/a511d931a59c4dc59eaeb7bccc96a542
 * @stitch-screen-title Log Behavioral Moment Form
 * @stitch-status converted
 * @stitch-last-sync 2026-02-15
 */
@Component({
  selector: 'app-behavioral-moment-create',
  imports: [RouterLink, ChipSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (!activeParticipantId()) {
        <section class="hero">
          <h1>Log Behavioral Moment</h1>
          <p class="muted">Identify the patterns behind the behavior.</p>
        </section>
        <section class="section-card">
          <p class="error" role="alert">Select a participant before logging an incident.</p>
          <a class="button secondary" routerLink="/profile">Select participant</a>
        </section>
      } @else if (created()) {
        <section class="hero">
          <h1>Incident saved</h1>
          <p class="muted">You can log another moment or return to insights.</p>
        </section>
        <section class="section-card">
          <div class="actions">
            <button class="button" type="button" (click)="logAnother()">Log another moment</button>
            <a class="button secondary" routerLink="/insights">Back to insights</a>
          </div>
        </section>
      } @else {
        <section class="hero">
          <h1>Log Behavioral Moment</h1>
          <p class="muted">Identify the patterns behind the behavior.</p>
        </section>

        <section class="section-card function-card">
          <h2>Function of Behavior</h2>
          <div class="function-grid" role="group" aria-label="Behavior function">
            @for (option of functionOptions; track option.value) {
              <button
                type="button"
                class="function-option"
                [class.selected]="selectedFunction() === option.value"
                (click)="selectFunction(option.value)"
              >
                <span class="material-symbols-outlined">{{ option.icon }}</span>
                <span>{{ option.label }}</span>
              </button>
            }
          </div>
        </section>

        <section class="section-card antecedent-card">
          <div class="section-heading">
            <span class="badge">A</span>
            <h3>Antecedent</h3>
          </div>
          <textarea
            class="notes"
            placeholder="Describe what happened before..."
            [value]="antecedentNotes()"
            (input)="antecedentNotes.set(asInputTarget($event).value)"
            rows="3"
          ></textarea>
          <p class="chip-label">Quick tags</p>
          <app-chip-selector
            [categories]="antecedentCategories"
            [selected]="antecedentChips()"
            (selectionChange)="antecedentChips.set($event)"
          />
        </section>

        <section class="section-card behavior-card">
          <div class="section-heading">
            <span class="badge">B</span>
            <h3>Behavior</h3>
          </div>
          <textarea
            class="notes"
            placeholder="Describe the behavior..."
            [value]="behaviorNotes()"
            (input)="behaviorNotes.set(asInputTarget($event).value)"
            rows="3"
          ></textarea>
          <p class="chip-label">Quick tags</p>
          <app-chip-selector
            [categories]="behaviorCategories"
            [selected]="behaviorChips()"
            (selectionChange)="behaviorChips.set($event)"
          />
        </section>

        <section class="section-card consequence-card">
          <div class="section-heading">
            <span class="badge">C</span>
            <h3>Consequence</h3>
          </div>
          <textarea
            class="notes"
            placeholder="What was the outcome?"
            [value]="consequenceNotes()"
            (input)="consequenceNotes.set(asInputTarget($event).value)"
            rows="3"
          ></textarea>
          <p class="chip-label">Quick tags</p>
          <app-chip-selector
            [categories]="consequenceCategories"
            [selected]="consequenceChips()"
            (selectionChange)="consequenceChips.set($event)"
          />
        </section>

        <section class="section-card place-card">
          <h2>Place</h2>
          <app-chip-selector
            [flatChips]="placeOptions"
            [selected]="selectedPlace() ? [selectedPlace()!] : []"
            [multiSelect]="false"
            (selectionChange)="selectedPlace.set($event[0] || null)"
          />
        </section>

        <section class="datetime-grid">
          <div class="datetime-card">
            <label for="occurredDate">Date</label>
            <input
              id="occurredDate"
              type="date"
              [value]="datePart()"
              (change)="onDateChange($event)"
            />
          </div>
          <div class="datetime-card">
            <label for="occurredTime">Time</label>
            <input
              id="occurredTime"
              type="time"
              [value]="timePart()"
              (change)="onTimeChange($event)"
            />
          </div>
        </section>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <button
          class="save-button"
          type="button"
          [disabled]="!canSave() || saving()"
          (click)="submit()"
        >
          <span class="material-symbols-outlined fill-1">check_circle</span>
          {{ saving() ? 'Saving...' : 'Save Incident' }}
        </button>
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

    .section-card {
      border-radius: 0.875rem;
      padding: 1rem;
      margin-bottom: 1rem;
      border: 1px solid #f1f5f9;
      background: #ffffff;
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
    .antecedent-card app-chip-selector {
      --chip-selected-bg: var(--color-energetic-amber, #f59e0b);
      --chip-selected-border: var(--color-energetic-amber, #f59e0b);
      --chip-selected-hover-bg: #d97706;
      --chip-selected-hover-border: #d97706;
      --chip-selected-shadow: 0 2px 8px rgba(245, 158, 11, 0.28);
    }

    .behavior-card {
      background: var(--color-soft-violet, #f5f3ff);
      border: none;
    }
    .behavior-card app-chip-selector {
      --chip-selected-bg: var(--color-electric-violet, #8b5cf6);
      --chip-selected-border: var(--color-electric-violet, #8b5cf6);
      --chip-selected-hover-bg: #7c3aed;
      --chip-selected-hover-border: #7c3aed;
      --chip-selected-shadow: 0 2px 8px rgba(139, 92, 246, 0.28);
    }

    .consequence-card {
      background: var(--color-soft-emerald, #ecfdf5);
      border: none;
    }
    .consequence-card app-chip-selector {
      --chip-selected-bg: var(--color-vital-emerald, #10b981);
      --chip-selected-border: var(--color-vital-emerald, #10b981);
      --chip-selected-hover-bg: #059669;
      --chip-selected-hover-border: #059669;
      --chip-selected-shadow: 0 2px 8px rgba(16, 185, 129, 0.28);
    }

    .place-card {
      background: var(--color-soft-azure, #f0f9ff);
      border: none;
    }
    .place-card app-chip-selector {
      --chip-selected-bg: var(--color-sky-azure, #0ea5e9);
      --chip-selected-border: var(--color-sky-azure, #0ea5e9);
      --chip-selected-hover-bg: #0284c7;
      --chip-selected-hover-border: #0284c7;
      --chip-selected-shadow: 0 2px 8px rgba(14, 165, 233, 0.28);
    }

    h2 {
      margin: 0 0 0.75rem;
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-electric-violet, #8b5cf6);
    }

    .place-card h2 {
      color: var(--color-sky-azure, #0ea5e9);
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
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.5rem 0.75rem;
      cursor: pointer;
    }

    .function-option.selected {
      border-color: var(--color-electric-violet, #8b5cf6);
      background: var(--color-electric-violet, #8b5cf6);
      color: #ffffff;
    }

    .section-heading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
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
      background: var(--color-energetic-amber, #f59e0b);
    }

    .behavior-card .badge {
      background: var(--color-electric-violet, #8b5cf6);
    }

    .consequence-card .badge {
      background: var(--color-vital-emerald, #10b981);
    }

    h3 {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-midnight-slate, #1e293b);
    }

    .notes {
      width: 100%;
      box-sizing: border-box;
      margin-top: 0;
      border-radius: 0.75rem;
      border: 1px solid #e2e8f0;
      min-height: 44px;
      padding: 0.75rem;
      resize: vertical;
      font: inherit;
    }

    .chip-label {
      margin: 0.625rem 0 0.25rem;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
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

    .save-button {
      width: 100%;
      min-height: 44px;
      border: 0;
      border-radius: 1rem;
      padding: 0.875rem 1rem;
      font-size: 1rem;
      font-weight: 700;
      color: #ffffff;
      background: var(--color-vital-emerald, #10b981);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .save-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .button {
      min-height: 44px;
      border: 0;
      border-radius: 999px;
      padding: 0.625rem 1rem;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--color-vital-emerald, #10b981);
      color: #ffffff;
    }

    .button.secondary {
      background: transparent;
      border: 1px solid var(--color-primary, #0c4a6e);
      color: var(--color-primary, #0c4a6e);
    }

    .actions {
      display: grid;
      gap: 0.75rem;
    }

    .error {
      margin: 0 0 1rem;
      color: #b91c1c;
      font-weight: 600;
      font-size: 0.875rem;
    }
  `]
})
export class BehavioralMomentCreateComponent {
  private readonly participants = inject(ParticipantService);
  private readonly incidents = inject(BehaviorIncidentService);
  private readonly router = inject(Router);

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly created = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly antecedentCategories = antecedentChipCategories;
  readonly behaviorCategories = behaviorChipCategories;
  readonly consequenceCategories = consequenceChipCategories;
  readonly placeOptions = placeChipOptions;
  readonly functionOptions = functionOptions;

  readonly selectedFunction = signal<BehaviorFunction | null>(null);
  readonly antecedentChips = signal<string[]>([]);
  readonly behaviorChips = signal<string[]>([]);
  readonly consequenceChips = signal<string[]>([]);
  readonly antecedentNotes = signal('');
  readonly behaviorNotes = signal('');
  readonly consequenceNotes = signal('');
  readonly selectedPlace = signal<string | null>(null);
  readonly occurredAt = signal(toLocalInputValue(new Date()));

  canSave(): boolean {
    return (
      this.selectedFunction() !== null &&
      (this.antecedentChips().length > 0 || this.antecedentNotes().trim().length > 0) &&
      (this.behaviorChips().length > 0 || this.behaviorNotes().trim().length > 0) &&
      (this.consequenceChips().length > 0 || this.consequenceNotes().trim().length > 0)
    );
  }

  datePart(): string {
    return this.occurredAt().slice(0, 10);
  }

  timePart(): string {
    return this.occurredAt().slice(11, 16);
  }

  selectFunction(fn: BehaviorFunction): void {
    this.selectedFunction.set(fn);
  }

  onDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const date = target.value;
    if (!date) {
      return;
    }
    this.occurredAt.set(`${date}T${this.timePart()}`);
  }

  onTimeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const time = target.value;
    if (!time) {
      return;
    }
    this.occurredAt.set(`${this.datePart()}T${time}`);
  }

  asInputTarget(event: Event): HTMLTextAreaElement {
    return event.target as HTMLTextAreaElement;
  }

  submit(): void {
    if (!this.canSave() || this.saving()) {
      return;
    }

    const participantId = this.activeParticipantId();
    if (!participantId) {
      this.error.set('Select a participant before logging an incident.');
      return;
    }

    const fn = this.selectedFunction();
    if (!fn) {
      this.error.set('Select a behavior function.');
      return;
    }

    const datetimeLocal = this.occurredAt();
    const logLocalDate = extractLocalDate(datetimeLocal);
    const logLocalTime = extractLocalTime(datetimeLocal);
    const logTzOffsetMinutes = computeTzOffsetMinutes(logLocalDate, logLocalTime);

    const antecedent = this.buildSummary(this.antecedentChips(), this.antecedentNotes());
    const behavior = this.buildSummary(this.behaviorChips(), this.behaviorNotes());
    const consequence = this.buildSummary(this.consequenceChips(), this.consequenceNotes());
    const place = this.selectedPlace() || 'Not specified';

    this.saving.set(true);
    this.error.set(null);

    this.incidents.createIncident(participantId, {
      antecedent,
      behavior,
      consequence,
      logLocalDate,
      logLocalTime,
      logTzOffsetMinutes,
      place,
      function: fn,
      antecedentChips: this.antecedentChips(),
      behaviorChips: this.behaviorChips(),
      consequenceChips: this.consequenceChips(),
      placeChip: this.selectedPlace() || undefined
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
    this.selectedFunction.set(null);
    this.antecedentChips.set([]);
    this.behaviorChips.set([]);
    this.consequenceChips.set([]);
    this.antecedentNotes.set('');
    this.behaviorNotes.set('');
    this.consequenceNotes.set('');
    this.selectedPlace.set(null);
    this.occurredAt.set(toLocalInputValue(new Date()));
    this.created.set(false);
    this.error.set(null);
  }

  logAnother(): void {
    this.reset();
    this.router.navigate(['/incidents/new']);
  }

  private buildSummary(chips: string[], notes: string): string {
    const parts: string[] = [];
    if (chips.length > 0) {
      parts.push(chips.join(', '));
    }
    const trimmedNotes = notes.trim();
    if (trimmedNotes) {
      parts.push(trimmedNotes);
    }
    return parts.join('. ') || '';
  }
}
