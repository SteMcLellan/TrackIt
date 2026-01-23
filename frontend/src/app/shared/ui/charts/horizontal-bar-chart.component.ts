import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface HorizontalBarChartData {
  label: string;
  value: number;
}

@Component({
  selector: 'app-horizontal-bar-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-container">
      @if (data().length === 0) {
        <div class="empty-state">
          <p class="empty-message">No data to display</p>
        </div>
      } @else {
        <div class="bars-container">
          @for (bar of bars(); track bar.label) {
            <div class="bar-row">
              <div class="bar-label">{{ bar.label }}</div>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  [style.width.%]="bar.percentage"
                ></div>
              </div>
              <div class="bar-value">{{ bar.value }}</div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .chart-container {
      width: 100%;
    }

    .bars-container {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .bar-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
      gap: var(--space-2);
      align-items: center;
    }

    .bar-label {
      font-size: var(--font-size-sm);
      color: var(--color-gray-700);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bar-track {
      background: var(--color-gray-100);
      height: 24px;
      border-radius: 4px;
      position: relative;
      overflow: hidden;
      min-width: 0;
    }

    .bar-fill {
      background: var(--color-primary);
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
      min-width: 2px;
    }

    .bar-value {
      font-size: var(--font-size-sm);
      color: var(--color-gray-900);
      font-weight: 600;
      min-width: 30px;
      text-align: right;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 120px;
      padding: var(--space-6);
    }

    .empty-message {
      color: var(--color-gray-500);
      font-size: var(--font-size-sm);
      text-align: center;
      margin: 0;
    }

    @media (min-width: 480px) {
      .bar-row {
        grid-template-columns: minmax(140px, 1fr) minmax(0, 3fr) auto;
      }
    }
  `]
})
export class HorizontalBarChartComponent {
  readonly data = input.required<HorizontalBarChartData[]>();

  readonly maxValue = computed(() => {
    const values = this.data().map(d => d.value);
    return Math.max(...values, 1);
  });

  readonly bars = computed(() => {
    const data = this.data();
    const max = this.maxValue();

    return data.map(item => ({
      label: item.label,
      value: item.value,
      percentage: (item.value / max) * 100
    }));
  });
}
