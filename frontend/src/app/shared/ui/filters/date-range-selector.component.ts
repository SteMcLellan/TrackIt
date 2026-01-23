import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type DateRangeOption = 7 | 14 | 30;

/**
 * Reusable date range selector with fixed 7/14/30 day options.
 * Used for consistent filtering across analytics and list pages.
 */
@Component({
  selector: 'app-date-range-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="context-bar">
      <span class="context-label">Showing last</span>
      <div class="range-buttons" role="group" aria-label="Date range">
        @for (option of options; track option.value) {
          <button
            type="button"
            class="range-button"
            [class.active]="selectedRange() === option.value"
            (click)="rangeChanged.emit(option.value)"
          >
            {{ option.label }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .context-bar {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) 0;
    }

    .context-label {
      color: var(--color-gray-600);
      font-size: var(--font-size-sm);
      font-weight: 500;
    }

    .range-buttons {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
      background: var(--color-gray-100);
      border-radius: var(--radius-full);
    }

    .range-button {
      border: none;
      background: transparent;
      padding: 0.3rem 0.65rem;
      border-radius: var(--radius-full);
      font-weight: 600;
      font-size: var(--font-size-sm);
      cursor: pointer;
      color: var(--color-gray-700);
      transition: background var(--transition-fast), color var(--transition-fast);
    }

    .range-button:hover {
      background: var(--color-gray-200);
    }

    .range-button.active {
      background: var(--color-primary);
      color: white;
    }
  `]
})
export class DateRangeSelectorComponent {
  readonly selectedRange = input.required<DateRangeOption>();
  readonly rangeChanged = output<DateRangeOption>();

  readonly options = [
    { value: 7 as const, label: '7 days' },
    { value: 14 as const, label: '14 days' },
    { value: 30 as const, label: '30 days' }
  ];
}
