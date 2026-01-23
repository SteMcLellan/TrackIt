import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BarChartData {
  label: string;
  value: number;
}

@Component({
  selector: 'app-bar-chart',
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
        <svg class="chart-svg" [attr.viewBox]="'0 0 ' + svgWidth() + ' ' + svgHeight()" preserveAspectRatio="xMidYMid meet">
          @for (bar of bars(); track $index) {
            <g>
              <!-- Bar -->
              <rect
                [attr.x]="bar.x"
                [attr.y]="bar.y"
                [attr.width]="bar.width"
                [attr.height]="bar.height"
                [attr.fill]="bar.isMax ? 'var(--color-primary)' : 'var(--color-gray-300)'"
                rx="2"
              />
              <!-- Value label above bar -->
              @if (bar.value > 0) {
                <text
                  [attr.x]="bar.x + bar.width / 2"
                  [attr.y]="bar.y - 8"
                  text-anchor="middle"
                  class="value-label"
                >{{ bar.value }}</text>
              }
              <!-- Date label below chart -->
              <text
                [attr.x]="bar.x + bar.width / 2"
                [attr.y]="svgHeight() - 10"
                text-anchor="middle"
                class="date-label"
              >{{ bar.shortLabel }}</text>
            </g>
          }
        </svg>
      }
    </div>
  `,
  styles: [`
    .chart-container {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      padding: var(--space-2) 0;
    }

    .chart-svg {
      width: 100%;
      height: auto;
      min-height: 200px;
      display: block;
    }

    .value-label {
      font-size: 11px;
      font-weight: 500;
      fill: var(--color-gray-700);
    }

    .date-label {
      font-size: 10px;
      fill: var(--color-gray-600);
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      padding: var(--space-6);
    }

    .empty-message {
      color: var(--color-gray-500);
      font-size: var(--font-size-sm);
      text-align: center;
      margin: 0;
    }
  `]
})
export class BarChartComponent {
  readonly data = input.required<BarChartData[]>();

  readonly barDimensions = computed(() => {
    const dataLength = this.data().length;

    // Responsive bar width based on data count
    // 7 days: 40px bars, 14 days: 24px bars, 30 days: 12px bars
    let barWidth: number;
    let barSpacing: number;
    if (dataLength <= 7) {
      barWidth = 40;
      barSpacing = 20;
    } else if (dataLength <= 14) {
      barWidth = 24;
      barSpacing = 12;
    } else {
      barWidth = 12;
      barSpacing = 8;
    }

    return { barWidth, barSpacing };
  });

  readonly svgWidth = computed(() => {
    const dataLength = this.data().length;
    const { barWidth, barSpacing } = this.barDimensions();
    // Calculate width needed: (barWidth + spacing) * count + extra spacing at start
    return dataLength * (barWidth + barSpacing) + barSpacing;
  });

  readonly svgHeight = computed(() => 280);

  readonly maxValue = computed(() => {
    const values = this.data().map(d => d.value);
    return Math.max(...values, 1);
  });

  readonly bars = computed(() => {
    const data = this.data();
    const max = this.maxValue();
    const dataLength = data.length;
    const chartHeight = 200;
    const topMargin = 30;
    const { barWidth, barSpacing } = this.barDimensions();

    return data.map((item, index) => {
      const barHeight = (item.value / max) * chartHeight;
      const x = index * (barWidth + barSpacing) + barSpacing;
      const y = topMargin + (chartHeight - barHeight);

      // Extract short label (e.g., "01/22" -> "22" or "Mon")
      const shortLabel = this.getShortLabel(item.label, index, data.length);

      return {
        x,
        y,
        width: barWidth,
        height: barHeight,
        value: item.value,
        isMax: item.value === max && item.value > 0,
        shortLabel
      };
    });
  });

  private getShortLabel(label: string, index: number, totalBars: number): string {
    // For date labels in format YYYY-MM-DD, extract day
    if (label.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = label.split('-');
      const day = parts[2];

      // Adaptive labeling based on range
      if (totalBars <= 7) {
        // Show all labels for 7 days
        return day;
      } else if (totalBars <= 14) {
        // Show every other label for 14 days
        return index % 2 === 0 ? day : '';
      } else {
        // Show every 7th label for 30 days (plus first and last)
        return (index === 0 || index === totalBars - 1 || index % 7 === 0) ? day : '';
      }
    }

    // For other labels, truncate if needed
    return label.length > 6 ? label.substring(0, 5) + '…' : label;
  }
}
