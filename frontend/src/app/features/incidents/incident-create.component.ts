import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card.component';
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
  extractLocalDate,
  extractLocalTime,
  computeTzOffsetMinutes
} from '../../shared/utils/datetime';
import { FunctionAttentionIconComponent } from '../../shared/ui/icons/function-attention-icon.component';
import { FunctionEscapeIconComponent } from '../../shared/ui/icons/function-escape-icon.component';
import { FunctionSensoryIconComponent } from '../../shared/ui/icons/function-sensory-icon.component';
import { FunctionTangibleIconComponent } from '../../shared/ui/icons/function-tangible-icon.component';

type FunctionOption = {
  value: BehaviorFunction;
  label: string;
  shortLabel: string;
};

export const functionOptions: FunctionOption[] = [
  { value: 'sensory', label: 'Automatically Rewarding (Sensory)', shortLabel: 'Sensory' },
  { value: 'tangible', label: 'Get What They Want', shortLabel: 'Tangible' },
  { value: 'escape', label: 'Avoid', shortLabel: 'Escape' },
  { value: 'attention', label: 'Attention', shortLabel: 'Attention' }
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

function formatTime(dateStr: string): string {
  const date = new Date(dateStr.replace('T', ' '));
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

@Component({
  selector: 'app-incident-create',
  imports: [
    RouterLink,
    CardComponent,
    ChipSelectorComponent,
    FunctionAttentionIconComponent,
    FunctionEscapeIconComponent,
    FunctionSensoryIconComponent,
    FunctionTangibleIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card class="card">
      @if (!activeParticipantId()) {
        <h2>Log an incident</h2>
        <p class="error" role="alert">Select a participant before logging an incident.</p>
        <a class="button secondary" routerLink="/profile">Select participant</a>
      } @else if (created()) {
        <h2>Incident saved</h2>
        <p class="muted">You can log another or return later.</p>
        <div class="actions">
          <button class="button" type="button" (click)="reset()">Log another incident</button>
          <a class="button secondary" routerLink="/home">Back to Home</a>
        </div>
      } @else if (!selectedFunction()) {
        <!-- Step 1: Function Selection -->
        <h2>What type of behavior?</h2>
        <p class="muted">Select the function that best describes why the behavior happened.</p>
        <div class="function-grid">
          @for (option of functionOptions; track option.value) {
            <button
              type="button"
              class="function-card"
              (click)="selectFunction(option.value)"
            >
              <span class="function-icon" aria-hidden="true">
                @switch (option.value) {
                  @case ('sensory') { <app-icon-function-sensory /> }
                  @case ('tangible') { <app-icon-function-tangible /> }
                  @case ('escape') { <app-icon-function-escape /> }
                  @case ('attention') { <app-icon-function-attention /> }
                }
              </span>
              <span class="function-label">{{ option.shortLabel }}</span>
            </button>
          }
        </div>
      } @else {
        <!-- Step 2: Details Entry -->
        <div class="header-row">
          <button type="button" class="back-btn" (click)="clearFunction()" aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 4l-6 6 6 6" />
            </svg>
          </button>
          <h2 class="header-title">{{ selectedFunctionLabel() }}</h2>
          <span class="header-time">{{ currentTimeDisplay() }}</span>
        </div>

        <div class="form-section">
          <div class="section-header">
            <span class="section-tag">A</span>
            <span class="section-label">What happened before?</span>
          </div>
          <app-chip-selector
            [categories]="antecedentCategories"
            [selected]="antecedentChips()"
            (selectionChange)="antecedentChips.set($event)"
          />
          <button
            type="button"
            class="expand-btn"
            [class.expanded]="showAntecedentNotes()"
            (click)="showAntecedentNotes.set(!showAntecedentNotes())"
          >
            {{ showAntecedentNotes() ? '- Hide details' : '+ Add details' }}
          </button>
          @if (showAntecedentNotes()) {
            <textarea
              class="notes"
              placeholder="Additional details..."
              [value]="antecedentNotes()"
              (input)="antecedentNotes.set(asInputTarget($event).value)"
              rows="2"
            ></textarea>
          }
        </div>

        <div class="form-section">
          <div class="section-header">
            <span class="section-tag">B</span>
            <span class="section-label">What behavior?</span>
          </div>
          <app-chip-selector
            [categories]="behaviorCategories"
            [selected]="behaviorChips()"
            (selectionChange)="behaviorChips.set($event)"
          />
          <button
            type="button"
            class="expand-btn"
            [class.expanded]="showBehaviorNotes()"
            (click)="showBehaviorNotes.set(!showBehaviorNotes())"
          >
            {{ showBehaviorNotes() ? '- Hide details' : '+ Add details' }}
          </button>
          @if (showBehaviorNotes()) {
            <textarea
              class="notes"
              placeholder="Additional details..."
              [value]="behaviorNotes()"
              (input)="behaviorNotes.set(asInputTarget($event).value)"
              rows="2"
            ></textarea>
          }
        </div>

        <div class="form-section">
          <div class="section-header">
            <span class="section-tag">C</span>
            <span class="section-label">What happened after?</span>
          </div>
          <app-chip-selector
            [categories]="consequenceCategories"
            [selected]="consequenceChips()"
            (selectionChange)="consequenceChips.set($event)"
          />
          <button
            type="button"
            class="expand-btn"
            [class.expanded]="showConsequenceNotes()"
            (click)="showConsequenceNotes.set(!showConsequenceNotes())"
          >
            {{ showConsequenceNotes() ? '- Hide details' : '+ Add details' }}
          </button>
          @if (showConsequenceNotes()) {
            <textarea
              class="notes"
              placeholder="Additional details..."
              [value]="consequenceNotes()"
              (input)="consequenceNotes.set(asInputTarget($event).value)"
              rows="2"
            ></textarea>
          }
        </div>

        <div class="meta-row">
          <div class="meta-field">
            <label class="meta-label">Where?</label>
            <app-chip-selector
              [flatChips]="placeOptions"
              [selected]="selectedPlace() ? [selectedPlace()!] : []"
              [multiSelect]="false"
              (selectionChange)="selectedPlace.set($event[0] || null)"
            />
          </div>
          <div class="meta-field">
            <label class="meta-label" for="occurredAt">When?</label>
            <input
              id="occurredAt"
              type="datetime-local"
              class="time-input"
              [value]="occurredAt()"
              (change)="onTimeChange($event)"
            />
          </div>
        </div>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <button
          class="button save-btn"
          type="button"
          [disabled]="!canSave() || saving()"
          (click)="submit()"
        >
          @if (saving()) {
            Saving...
          } @else {
            Save Incident
          }
        </button>
      }
    </app-card>
  `,
  styles: [`
    .card {
      width: 100%;
      max-width: none;
      margin: 0;
      box-sizing: border-box;
    }
    h2 {
      margin: 0 0 var(--space-2, 0.5rem);
      font-size: var(--font-size-lg, 1.125rem);
    }
    .muted {
      margin: 0 0 var(--space-3, 0.75rem);
      color: var(--color-text-muted, #64748b);
      font-size: var(--font-size-sm, 0.8125rem);
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
      min-height: 44px;
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
    .function-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-3, 0.75rem);
      margin-top: var(--space-3, 0.75rem);
    }
    .function-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2, 0.5rem);
      padding: var(--space-4, 1rem);
      min-height: 100px;
      border: 1px solid #e2e8f0;
      border-radius: var(--radius-2, 0.5rem);
      background: #fff;
      cursor: pointer;
      transition: border-color var(--transition-fast, 120ms ease),
                  box-shadow var(--transition-fast, 120ms ease),
                  background var(--transition-fast, 120ms ease);
    }
    .function-card:hover {
      border-color: var(--color-primary, #0c4a6e);
      box-shadow: 0 2px 8px rgba(12, 74, 110, 0.12);
    }
    .function-card:active {
      background: rgba(12, 74, 110, 0.04);
    }
    .function-icon {
      display: flex;
      color: var(--color-primary, #0c4a6e);
    }
    .function-label {
      font-weight: 700;
      color: #0f172a;
      font-size: var(--font-size-sm, 0.8125rem);
    }
    .header-row {
      display: flex;
      align-items: center;
      gap: var(--space-2, 0.5rem);
      margin-bottom: var(--space-4, 1rem);
      padding-bottom: var(--space-3, 0.75rem);
      border-bottom: 1px solid #e2e8f0;
    }
    .back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: none;
      background: transparent;
      color: var(--color-text-muted, #64748b);
      cursor: pointer;
      border-radius: var(--radius-full, 999px);
      transition: background var(--transition-fast, 120ms ease),
                  color var(--transition-fast, 120ms ease);
    }
    .back-btn:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    .header-title {
      flex: 1;
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #0f172a;
    }
    .header-time {
      font-size: var(--font-size-sm, 0.8125rem);
      color: var(--color-text-muted, #64748b);
    }
    .form-section {
      margin-bottom: var(--space-4, 1rem);
      padding-bottom: var(--space-4, 1rem);
      border-bottom: 1px solid #f1f5f9;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: var(--space-2, 0.5rem);
      margin-bottom: var(--space-3, 0.75rem);
    }
    .section-tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 999px;
      background: rgba(12, 74, 110, 0.12);
      color: var(--color-primary, #0c4a6e);
      font-weight: 700;
      font-size: 0.8rem;
    }
    .section-label {
      font-weight: 600;
      color: #0f172a;
    }
    .expand-btn {
      display: inline-flex;
      align-items: center;
      margin-top: var(--space-2, 0.5rem);
      padding: 0;
      border: none;
      background: transparent;
      color: var(--color-primary, #0c4a6e);
      font-size: var(--font-size-sm, 0.8125rem);
      font-weight: 600;
      cursor: pointer;
    }
    .expand-btn:hover {
      text-decoration: underline;
    }
    .notes {
      width: 100%;
      margin-top: var(--space-2, 0.5rem);
      padding: 0.6rem 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: var(--radius-2, 0.5rem);
      font-size: 0.9375rem;
      font-family: inherit;
      resize: vertical;
      box-sizing: border-box;
    }
    .meta-row {
      display: grid;
      gap: var(--space-4, 1rem);
      margin-bottom: var(--space-4, 1rem);
    }
    .meta-field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2, 0.5rem);
    }
    .meta-label {
      font-weight: 600;
      font-size: var(--font-size-sm, 0.8125rem);
      color: #0f172a;
    }
    .time-input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: var(--radius-2, 0.5rem);
      font-size: 0.9375rem;
      font-family: inherit;
      min-height: 44px;
    }
    .save-btn {
      width: 100%;
      padding: 0.75rem 1.25rem;
      font-size: 1rem;
    }
    @media (min-width: 640px) {
      .meta-row {
        grid-template-columns: 1fr auto;
        align-items: end;
      }
    }
  `]
})
export class IncidentCreateComponent {
  private readonly participants = inject(ParticipantService);
  private readonly incidents = inject(BehaviorIncidentService);

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly created = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly functionOptions = functionOptions;

  // Chip categories
  readonly antecedentCategories = antecedentChipCategories;
  readonly behaviorCategories = behaviorChipCategories;
  readonly consequenceCategories = consequenceChipCategories;
  readonly placeOptions = placeChipOptions;

  // Form state
  readonly selectedFunction = signal<BehaviorFunction | null>(null);
  readonly antecedentChips = signal<string[]>([]);
  readonly behaviorChips = signal<string[]>([]);
  readonly consequenceChips = signal<string[]>([]);
  readonly antecedentNotes = signal('');
  readonly behaviorNotes = signal('');
  readonly consequenceNotes = signal('');
  readonly selectedPlace = signal<string | null>(null);
  readonly occurredAt = signal(toLocalInputValue(new Date()));

  // UI state
  readonly showAntecedentNotes = signal(false);
  readonly showBehaviorNotes = signal(false);
  readonly showConsequenceNotes = signal(false);

  selectedFunctionLabel(): string {
    const fn = this.selectedFunction();
    if (!fn) return '';
    return functionOptions.find(o => o.value === fn)?.shortLabel ?? fn;
  }

  currentTimeDisplay(): string {
    return formatTime(this.occurredAt());
  }

  canSave(): boolean {
    return (
      this.selectedFunction() !== null &&
      (this.antecedentChips().length > 0 || this.antecedentNotes().trim().length > 0) &&
      (this.behaviorChips().length > 0 || this.behaviorNotes().trim().length > 0) &&
      (this.consequenceChips().length > 0 || this.consequenceNotes().trim().length > 0)
    );
  }

  selectFunction(fn: BehaviorFunction): void {
    this.selectedFunction.set(fn);
  }

  clearFunction(): void {
    this.selectedFunction.set(null);
  }

  onTimeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.value) {
      this.occurredAt.set(target.value);
    }
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

    // Build text summaries from chips + notes
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
    this.showAntecedentNotes.set(false);
    this.showBehaviorNotes.set(false);
    this.showConsequenceNotes.set(false);
    this.created.set(false);
    this.error.set(null);
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
