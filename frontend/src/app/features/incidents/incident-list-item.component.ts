import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  FunctionAttentionIconComponent,
  FunctionEscapeIconComponent,
  FunctionSensoryIconComponent,
  FunctionTangibleIconComponent,
  NotesIconComponent
} from '../../shared/ui/icons';
import { BehaviorIncident, BehaviorFunction } from '../../shared/models/behavior-incident';

const functionLabels: Record<BehaviorFunction, string> = {
  sensory: 'Sensory',
  tangible: 'Tangible',
  escape: 'Escape',
  attention: 'Attention'
};

const functionColors: Record<BehaviorFunction, string> = {
  escape: '#ef4444',
  attention: '#eab308',
  sensory: '#3b82f6',
  tangible: '#22c55e'
};

@Component({
  selector: 'app-incident-list-item',
  imports: [
    FunctionAttentionIconComponent,
    FunctionEscapeIconComponent,
    FunctionSensoryIconComponent,
    FunctionTangibleIconComponent,
    NotesIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="item"
      [style.--function-color]="getFunctionColor(incident().function)"
      (click)="selected.emit(incident())"
      role="button"
      tabindex="0"
      (keydown.enter)="selected.emit(incident())"
      (keydown.space)="selected.emit(incident())"
    >
      <div class="meta">
        <span class="function-icon" [title]="functionLabels[incident().function]">
          @switch (incident().function) {
            @case ('sensory') { <app-icon-function-sensory /> }
            @case ('tangible') { <app-icon-function-tangible /> }
            @case ('escape') { <app-icon-function-escape /> }
            @case ('attention') { <app-icon-function-attention /> }
          }
        </span>
        <span class="time">{{ formatShortTime(incident().occurredAtUtc) }}</span>
        <span class="dot">&middot;</span>
        <span class="place">{{ incident().placeChip || incident().place }}</span>
        @if (hasNotes(incident())) {
          <span class="notes-indicator" title="Has additional notes">
            <app-icon-notes />
          </span>
        }
      </div>
      <div class="summary">
        {{ getChipSummary(incident()) }}
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .item {
      border: 1px solid #e2e8f0;
      border-left: 4px solid var(--function-color, #0c4a6e);
      border-radius: var(--radius-2, 0.5rem);
      padding: var(--space-3, 0.75rem);
      background: #fff;
      cursor: pointer;
      transition: box-shadow var(--transition-fast, 120ms ease),
                  border-color var(--transition-fast, 120ms ease);
      min-width: 0;
    }
    .item:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border-color: #cbd5e1;
    }
    .item:active {
      background: #f8fafc;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      margin-bottom: 0.25rem;
      font-size: var(--font-size-sm, 0.8125rem);
      color: var(--color-text-muted, #64748b);
    }
    .function-icon {
      display: inline-flex;
      color: var(--function-color, #64748b);
      flex-shrink: 0;
    }
    .time {
      font-weight: 600;
    }
    .dot {
      color: #cbd5e1;
    }
    .place {
      font-weight: 500;
    }
    .notes-indicator {
      display: inline-flex;
      font-size: 16px;
      color: var(--color-primary, #0c4a6e);
      opacity: 0.7;
      margin-left: auto;
    }
    .summary {
      font-size: 0.9375rem;
      color: #1f2937;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class IncidentListItemComponent {
  readonly incident = input.required<BehaviorIncident>();
  readonly selected = output<BehaviorIncident>();

  readonly functionLabels = functionLabels;

  getFunctionColor(fn: BehaviorFunction): string {
    return functionColors[fn];
  }

  getChipSummary(incident: BehaviorIncident): string {
    const parts: string[] = [];
    const antecedent = incident.antecedentChips?.[0] || this.getFirstPart(incident.antecedent);
    const behavior = incident.behaviorChips?.[0] || this.getFirstPart(incident.behavior);
    const consequence = incident.consequenceChips?.[0] || this.getFirstPart(incident.consequence);

    if (antecedent) parts.push(antecedent);
    if (behavior) parts.push(behavior);
    if (consequence) parts.push(consequence);

    return parts.join(' → ') || 'No details';
  }

  hasNotes(incident: BehaviorIncident): boolean {
    const hasAntecedentNotes = incident.antecedent && (
      !incident.antecedentChips?.length ||
      incident.antecedent !== incident.antecedentChips.join(', ')
    );
    const hasBehaviorNotes = incident.behavior && (
      !incident.behaviorChips?.length ||
      incident.behavior !== incident.behaviorChips.join(', ')
    );
    const hasConsequenceNotes = incident.consequence && (
      !incident.consequenceChips?.length ||
      incident.consequence !== incident.consequenceChips.join(', ')
    );

    return !!(hasAntecedentNotes || hasBehaviorNotes || hasConsequenceNotes);
  }

  formatShortTime(value: string): string {
    const date = new Date(value);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private getFirstPart(text: string): string {
    if (!text) return '';
    const commaIndex = text.indexOf(',');
    const periodIndex = text.indexOf('.');
    let endIndex = text.length;
    if (commaIndex > 0) endIndex = Math.min(endIndex, commaIndex);
    if (periodIndex > 0) endIndex = Math.min(endIndex, periodIndex);
    const part = text.slice(0, endIndex).trim();
    return part.length > 30 ? part.slice(0, 30) + '...' : part;
  }
}
