import { ChangeDetectionStrategy, Component, input, output, computed } from '@angular/core';
import { ChipCategory } from '../models/incident-chip-options';

@Component({
  selector: 'app-chip-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (categories().length > 0) {
      @for (category of categories(); track category.label) {
        <div class="category">
          <div class="category-label">{{ category.label }}</div>
          <div class="chip-row">
            @for (chip of category.chips; track chip) {
              <button
                type="button"
                class="chip"
                [class.selected]="isSelected(chip)"
                [attr.aria-pressed]="isSelected(chip)"
                (click)="toggle(chip)"
              >
                {{ chip }}
              </button>
            }
          </div>
        </div>
      }
    } @else {
      <div class="chip-row">
        @for (chip of flatChips(); track chip) {
          <button
            type="button"
            class="chip"
            [class.selected]="isSelected(chip)"
            [attr.aria-pressed]="isSelected(chip)"
            (click)="toggle(chip)"
          >
            {{ chip }}
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }
    .category {
      margin-bottom: var(--space-3, 0.75rem);
    }
    .category:last-child {
      margin-bottom: 0;
    }
    .category-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text-muted, #64748b);
      text-transform: uppercase;
      letter-spacing: 0.025em;
      margin-bottom: var(--space-2, 0.5rem);
    }
    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2, 0.5rem);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0.5rem 0.875rem;
      border-radius: var(--radius-full, 999px);
      border: 1px solid #e2e8f0;
      background: #fff;
      font-size: var(--font-size-sm, 0.8125rem);
      font-weight: 500;
      color: #334155;
      cursor: pointer;
      transition: background var(--transition-fast, 120ms ease),
                  border-color var(--transition-fast, 120ms ease),
                  color var(--transition-fast, 120ms ease),
                  box-shadow var(--transition-fast, 120ms ease);
      -webkit-tap-highlight-color: transparent;
    }
    .chip:hover {
      border-color: #cbd5e1;
      background: #f8fafc;
    }
    .chip:active {
      transform: scale(0.97);
    }
    .chip.selected {
      background: var(--chip-selected-bg, var(--color-primary, #0c4a6e));
      border-color: var(--chip-selected-border, var(--chip-selected-bg, var(--color-primary, #0c4a6e)));
      color: #fff;
      box-shadow: var(--chip-selected-shadow, 0 2px 4px rgba(12, 74, 110, 0.2));
    }
    .chip.selected:hover {
      background: var(--chip-selected-hover-bg, var(--chip-selected-bg, #0a3d5c));
      border-color: var(--chip-selected-hover-border, var(--chip-selected-border, var(--chip-selected-hover-bg, #0a3d5c)));
    }
  `]
})
export class ChipSelectorComponent {
  readonly categories = input<ChipCategory[]>([]);
  readonly flatChips = input<string[]>([]);
  readonly selected = input<string[]>([]);
  readonly multiSelect = input(true);
  readonly selectionChange = output<string[]>();

  readonly selectedSet = computed(() => new Set(this.selected()));

  isSelected(chip: string): boolean {
    return this.selectedSet().has(chip);
  }

  toggle(chip: string): void {
    const current = this.selected();
    const isCurrentlySelected = current.includes(chip);

    let newSelection: string[];
    if (this.multiSelect()) {
      newSelection = isCurrentlySelected
        ? current.filter(c => c !== chip)
        : [...current, chip];
    } else {
      newSelection = isCurrentlySelected ? [] : [chip];
    }

    this.selectionChange.emit(newSelection);
  }
}
