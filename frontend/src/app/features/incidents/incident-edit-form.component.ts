import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { BehaviorIncident, BehaviorFunction } from '../../shared/models/behavior-incident';
import { BehaviorIncidentService, UpdateBehaviorIncidentRequest } from '../../shared/services/behavior-incident.service';
import { ChipSelectorComponent } from '../../shared/ui/chip-selector.component';
import {
  antecedentChipCategories,
  behaviorChipCategories,
  consequenceChipCategories,
  placeChipOptions,
  allAntecedentChips,
  allBehaviorChips,
  allConsequenceChips
} from '../../shared/models/incident-chip-options';
import {
  extractLocalDate,
  extractLocalTime,
  computeTzOffsetMinutes,
  toDatetimeLocalInput
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

const functionOptions: FunctionOption[] = [
  { value: 'sensory', label: 'Automatically Rewarding (Sensory)', shortLabel: 'Sensory' },
  { value: 'tangible', label: 'Get What They Want', shortLabel: 'Tangible' },
  { value: 'escape', label: 'Avoid', shortLabel: 'Escape' },
  { value: 'attention', label: 'Attention', shortLabel: 'Attention' }
];

@Component({
  selector: 'app-incident-edit-form',
  imports: [
    ChipSelectorComponent,
    FunctionAttentionIconComponent,
    FunctionEscapeIconComponent,
    FunctionSensoryIconComponent,
    FunctionTangibleIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="edit-form">
      @if (warning()) {
        <p class="warning" role="alert">{{ warning() }}</p>
      }

      <!-- Function selector -->
      <div class="section">
        <label class="section-label">Function</label>
        <div class="function-grid">
          @for (option of functionOptions; track option.value) {
            <button
              type="button"
              class="function-card"
              [class.active]="selectedFunction() === option.value"
              (click)="selectedFunction.set(option.value)"
            >
              <span class="function-icon" aria-hidden="true">
                @switch (option.value) {
                  @case ('sensory') { <app-icon-function-sensory /> }
                  @case ('tangible') { <app-icon-function-tangible /> }
                  @case ('escape') { <app-icon-function-escape /> }
                  @case ('attention') { <app-icon-function-attention /> }
                }
              </span>
              <span class="function-name">{{ option.shortLabel }}</span>
            </button>
          }
        </div>
      </div>

      <!-- Antecedent -->
      <div class="section">
        <div class="section-header">
          <span class="section-tag">A</span>
          <span class="section-title">What happened before?</span>
        </div>
        <app-chip-selector
          [categories]="antecedentCategories"
          [selected]="antecedentChips()"
          (selectionChange)="antecedentChips.set($event)"
        />
        <button
          type="button"
          class="expand-btn"
          (click)="showAntecedentNotes.set(!showAntecedentNotes())"
        >
          {{ showAntecedentNotes() ? '- Hide details' : '+ Add details' }}
        </button>
        @if (showAntecedentNotes()) {
          <textarea
            class="notes"
            placeholder="Additional details..."
            [value]="antecedentNotes()"
            (input)="antecedentNotes.set(asTextarea($event).value)"
            rows="2"
          ></textarea>
        }
      </div>

      <!-- Behavior -->
      <div class="section">
        <div class="section-header">
          <span class="section-tag">B</span>
          <span class="section-title">What behavior?</span>
        </div>
        <app-chip-selector
          [categories]="behaviorCategories"
          [selected]="behaviorChips()"
          (selectionChange)="behaviorChips.set($event)"
        />
        <button
          type="button"
          class="expand-btn"
          (click)="showBehaviorNotes.set(!showBehaviorNotes())"
        >
          {{ showBehaviorNotes() ? '- Hide details' : '+ Add details' }}
        </button>
        @if (showBehaviorNotes()) {
          <textarea
            class="notes"
            placeholder="Additional details..."
            [value]="behaviorNotes()"
            (input)="behaviorNotes.set(asTextarea($event).value)"
            rows="2"
          ></textarea>
        }
      </div>

      <!-- Consequence -->
      <div class="section">
        <div class="section-header">
          <span class="section-tag">C</span>
          <span class="section-title">What happened after?</span>
        </div>
        <app-chip-selector
          [categories]="consequenceCategories"
          [selected]="consequenceChips()"
          (selectionChange)="consequenceChips.set($event)"
        />
        <button
          type="button"
          class="expand-btn"
          (click)="showConsequenceNotes.set(!showConsequenceNotes())"
        >
          {{ showConsequenceNotes() ? '- Hide details' : '+ Add details' }}
        </button>
        @if (showConsequenceNotes()) {
          <textarea
            class="notes"
            placeholder="Additional details..."
            [value]="consequenceNotes()"
            (input)="consequenceNotes.set(asTextarea($event).value)"
            rows="2"
          ></textarea>
        }
      </div>

      <!-- Place & Time -->
      <div class="meta-section">
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
          <label class="meta-label" for="edit-occurredAt">When?</label>
          <input
            id="edit-occurredAt"
            type="datetime-local"
            class="time-input"
            [value]="occurredAt()"
            (change)="onTimeChange($event)"
          />
        </div>
      </div>

      @if (saveError()) {
        <p class="error" role="alert">{{ saveError() }}</p>
      }

      <div class="actions">
        <button
          class="button primary"
          type="button"
          [disabled]="!canSave() || saving()"
          (click)="save()"
        >
          @if (saving()) {
            Saving...
          } @else {
            Save changes
          }
        </button>
        <button
          class="button ghost"
          type="button"
          (click)="cancelEdit()"
          [disabled]="saving()"
        >
          Cancel
        </button>
        <button
          class="button danger"
          type="button"
          (click)="removeIncident()"
          [disabled]="saving()"
        >
          Delete
        </button>
      </div>
    </div>
  `,
  styles: [`
    .edit-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4, 1rem);
    }
    .section {
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: var(--space-4, 1rem);
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
    .section-title {
      font-weight: 600;
      color: #0f172a;
    }
    .section-label {
      display: block;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: var(--space-2, 0.5rem);
    }
    .function-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-2, 0.5rem);
    }
    .function-card {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.65rem;
      border-radius: var(--radius-2, 0.5rem);
      border: 1px solid #e2e8f0;
      background: #fff;
      cursor: pointer;
      transition: border-color var(--transition-fast, 120ms ease),
                  background var(--transition-fast, 120ms ease);
    }
    .function-card:hover {
      border-color: #cbd5e1;
    }
    .function-card.active {
      border-color: var(--color-primary, #0c4a6e);
      background: rgba(12, 74, 110, 0.08);
    }
    .function-icon {
      display: flex;
      color: var(--color-primary, #0c4a6e);
    }
    .function-name {
      font-weight: 600;
      font-size: var(--font-size-sm, 0.8125rem);
      color: #0f172a;
    }
    .expand-btn {
      display: inline-flex;
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
    .meta-section {
      display: grid;
      gap: var(--space-3, 0.75rem);
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
    .actions {
      display: flex;
      gap: var(--space-3, 0.75rem);
      flex-wrap: wrap;
      padding-top: var(--space-2, 0.5rem);
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.55rem 1.1rem;
      border-radius: var(--radius-2, 0.5rem);
      font-weight: 600;
      border: none;
      cursor: pointer;
      min-height: 44px;
    }
    .button.primary {
      background: var(--color-primary, #0c4a6e);
      color: #fff;
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
      margin: 0;
      color: #b91c1c;
      font-weight: 600;
    }
    .warning {
      margin: 0;
      padding: var(--space-3, 0.75rem);
      background: #fef3c7;
      border-radius: var(--radius-2, 0.5rem);
      color: #b45309;
      font-weight: 600;
      font-size: var(--font-size-sm, 0.8125rem);
    }
  `]
})
export class IncidentEditFormComponent {
  private readonly incidents = inject(BehaviorIncidentService);

  readonly incident = input.required<BehaviorIncident>();
  readonly cancel = output();
  readonly saved = output<BehaviorIncident>();
  readonly remove = output();

  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly warning = signal<string | null>(null);
  readonly functionOptions = functionOptions;

  // Chip categories
  readonly antecedentCategories = antecedentChipCategories;
  readonly behaviorCategories = behaviorChipCategories;
  readonly consequenceCategories = consequenceChipCategories;
  readonly placeOptions = placeChipOptions;

  // Form state
  readonly selectedFunction = signal<BehaviorFunction>('escape');
  readonly antecedentChips = signal<string[]>([]);
  readonly behaviorChips = signal<string[]>([]);
  readonly consequenceChips = signal<string[]>([]);
  readonly antecedentNotes = signal('');
  readonly behaviorNotes = signal('');
  readonly consequenceNotes = signal('');
  readonly selectedPlace = signal<string | null>(null);
  readonly occurredAt = signal('');

  // UI state
  readonly showAntecedentNotes = signal(false);
  readonly showBehaviorNotes = signal(false);
  readonly showConsequenceNotes = signal(false);

  constructor() {
    effect(() => {
      const incident = this.incident();
      this.initFromIncident(incident);
    });
  }

  private initFromIncident(incident: BehaviorIncident): void {
    this.selectedFunction.set(incident.function);
    this.occurredAt.set(toDatetimeLocalInput(incident.logLocalDate, incident.logLocalTime));

    // Initialize chips - use stored chips or try to parse from text
    if (incident.antecedentChips?.length) {
      this.antecedentChips.set([...incident.antecedentChips]);
      this.antecedentNotes.set(this.extractNotes(incident.antecedent, incident.antecedentChips));
    } else {
      const parsed = this.parseChipsFromText(incident.antecedent, allAntecedentChips);
      this.antecedentChips.set(parsed.chips);
      this.antecedentNotes.set(parsed.notes);
    }

    if (incident.behaviorChips?.length) {
      this.behaviorChips.set([...incident.behaviorChips]);
      this.behaviorNotes.set(this.extractNotes(incident.behavior, incident.behaviorChips));
    } else {
      const parsed = this.parseChipsFromText(incident.behavior, allBehaviorChips);
      this.behaviorChips.set(parsed.chips);
      this.behaviorNotes.set(parsed.notes);
    }

    if (incident.consequenceChips?.length) {
      this.consequenceChips.set([...incident.consequenceChips]);
      this.consequenceNotes.set(this.extractNotes(incident.consequence, incident.consequenceChips));
    } else {
      const parsed = this.parseChipsFromText(incident.consequence, allConsequenceChips);
      this.consequenceChips.set(parsed.chips);
      this.consequenceNotes.set(parsed.notes);
    }

    // Set place
    if (incident.placeChip) {
      this.selectedPlace.set(incident.placeChip);
    } else if (placeChipOptions.includes(incident.place)) {
      this.selectedPlace.set(incident.place);
    } else {
      this.selectedPlace.set(null);
    }

    // Show notes if they exist
    this.showAntecedentNotes.set(!!this.antecedentNotes());
    this.showBehaviorNotes.set(!!this.behaviorNotes());
    this.showConsequenceNotes.set(!!this.consequenceNotes());

    // Check if old incident
    const occurredAt = new Date(incident.occurredAtUtc).getTime();
    const ageDays = (Date.now() - occurredAt) / (1000 * 60 * 60 * 24);
    if (ageDays > 30) {
      this.warning.set('You are editing an older incident. Please confirm the details carefully.');
    } else {
      this.warning.set(null);
    }
  }

  private parseChipsFromText(text: string, knownChips: string[]): { chips: string[]; notes: string } {
    if (!text) return { chips: [], notes: '' };

    const foundChips: string[] = [];
    let remaining = text;

    for (const chip of knownChips) {
      if (text.toLowerCase().includes(chip.toLowerCase())) {
        foundChips.push(chip);
        remaining = remaining.replace(new RegExp(chip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
      }
    }

    // Clean up remaining text
    remaining = remaining.replace(/^[\s,.\-]+|[\s,.\-]+$/g, '').trim();
    remaining = remaining.replace(/\s*,\s*/g, ', ');

    return { chips: foundChips, notes: remaining };
  }

  private extractNotes(text: string, chips: string[]): string {
    if (!text || !chips.length) return text || '';

    let remaining = text;
    for (const chip of chips) {
      remaining = remaining.replace(new RegExp(chip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    }

    return remaining.replace(/^[\s,.\-]+|[\s,.\-]+$/g, '').trim();
  }

  canSave(): boolean {
    return (
      (this.antecedentChips().length > 0 || this.antecedentNotes().trim().length > 0) &&
      (this.behaviorChips().length > 0 || this.behaviorNotes().trim().length > 0) &&
      (this.consequenceChips().length > 0 || this.consequenceNotes().trim().length > 0)
    );
  }

  onTimeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.value) {
      this.occurredAt.set(target.value);
    }
  }

  asTextarea(event: Event): HTMLTextAreaElement {
    return event.target as HTMLTextAreaElement;
  }

  cancelEdit(): void {
    this.cancel.emit();
  }

  removeIncident(): void {
    this.remove.emit();
  }

  save(): void {
    if (!this.canSave() || this.saving()) {
      return;
    }

    const incident = this.incident();
    const datetimeLocal = this.occurredAt();
    const logLocalDate = extractLocalDate(datetimeLocal);
    const logLocalTime = extractLocalTime(datetimeLocal);
    const logTzOffsetMinutes = computeTzOffsetMinutes(logLocalDate, logLocalTime);

    // Build text summaries
    const antecedent = this.buildSummary(this.antecedentChips(), this.antecedentNotes());
    const behavior = this.buildSummary(this.behaviorChips(), this.behaviorNotes());
    const consequence = this.buildSummary(this.consequenceChips(), this.consequenceNotes());
    const place = this.selectedPlace() || incident.place || 'Not specified';

    const payload: UpdateBehaviorIncidentRequest = {
      logLocalDate,
      logLocalTime,
      logTzOffsetMinutes,
      place,
      function: this.selectedFunction(),
      antecedent,
      behavior,
      consequence,
      antecedentChips: this.antecedentChips(),
      behaviorChips: this.behaviorChips(),
      consequenceChips: this.consequenceChips(),
      placeChip: this.selectedPlace() || undefined
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
