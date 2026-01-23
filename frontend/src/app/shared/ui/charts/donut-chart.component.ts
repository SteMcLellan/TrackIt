import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DonutChartData {
  label: string;
  value: number;
  color: string;
}

interface DonutSegment {
  path: string;
  color: string;
  label: string;
  value: number;
  percentage: number;
}

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-container">
      @if (total() === 0) {
        <div class="empty-state">
          <p class="empty-message">No data to display</p>
        </div>
      } @else {
        <div class="donut-wrapper">
          <!-- Donut Chart -->
          <svg class="donut-svg" viewBox="0 0 200 200">
            <g transform="translate(100, 100)">
              @for (segment of segments(); track segment.label) {
                <path
                  [attr.d]="segment.path"
                  [attr.fill]="segment.color"
                />
              }
              <!-- Center circle for donut hole -->
              <circle r="50" fill="var(--color-white)" />
              <!-- Total count in center -->
              <text
                text-anchor="middle"
                dominant-baseline="central"
                class="center-total"
              >{{ total() }}</text>
            </g>
          </svg>

          <!-- Legend -->
          <div class="legend">
            @for (segment of segments(); track segment.label) {
              <div class="legend-item">
                <div class="legend-dot" [style.background-color]="segment.color"></div>
                <div class="legend-label">
                  <span class="legend-name">{{ segment.label }}</span>
                  <span class="legend-value">{{ segment.value }} ({{ segment.percentage }}%)</span>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .chart-container {
      width: 100%;
    }

    .donut-wrapper {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      align-items: center;
    }

    .donut-svg {
      width: 200px;
      height: 200px;
      flex-shrink: 0;
    }

    .center-total {
      font-size: 32px;
      font-weight: 600;
      fill: var(--color-gray-900);
    }

    .legend {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: 100%;
      max-width: 300px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .legend-label {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .legend-name {
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-gray-900);
    }

    .legend-value {
      font-size: var(--font-size-xs);
      color: var(--color-gray-600);
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

    @media (min-width: 480px) {
      .donut-wrapper {
        flex-direction: row;
        justify-content: center;
      }

      .legend {
        max-width: 200px;
      }
    }
  `]
})
export class DonutChartComponent {
  readonly data = input.required<DonutChartData[]>();

  readonly total = computed(() => {
    return this.data().reduce((sum, item) => sum + item.value, 0);
  });

  readonly segments = computed(() => {
    const data = this.data().filter(d => d.value > 0);
    const total = this.total();

    if (total === 0) return [];

    const segments: DonutSegment[] = [];
    let currentAngle = -90; // Start at top (12 o'clock)

    for (const item of data) {
      const percentage = Math.round((item.value / total) * 100);
      const angleDegrees = (item.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleDegrees;

      const path = this.createArcPath(startAngle, endAngle, 70, 50);

      segments.push({
        path,
        color: item.color,
        label: item.label,
        value: item.value,
        percentage
      });

      currentAngle = endAngle;
    }

    return segments;
  });

  private createArcPath(
    startAngleDeg: number,
    endAngleDeg: number,
    outerRadius: number,
    innerRadius: number
  ): string {
    const startAngle = (startAngleDeg * Math.PI) / 180;
    const endAngle = (endAngleDeg * Math.PI) / 180;

    const x1 = outerRadius * Math.cos(startAngle);
    const y1 = outerRadius * Math.sin(startAngle);
    const x2 = outerRadius * Math.cos(endAngle);
    const y2 = outerRadius * Math.sin(endAngle);

    const x3 = innerRadius * Math.cos(endAngle);
    const y3 = innerRadius * Math.sin(endAngle);
    const x4 = innerRadius * Math.cos(startAngle);
    const y4 = innerRadius * Math.sin(startAngle);

    const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0;

    return [
      `M ${x1} ${y1}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ');
  }
}
