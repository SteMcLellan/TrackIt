import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BehaviorIncident } from '../../shared/models/behavior-incident';
import { CollectionResponse } from '../../shared/models/collection';
import { ParticipantService } from '../../shared/services/participant.service';
import { CardComponent } from '../../shared/ui/card.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { BarChartComponent } from '../../shared/ui/charts/bar-chart.component';
import { DonutChartComponent } from '../../shared/ui/charts/donut-chart.component';
import { HorizontalBarChartComponent } from '../../shared/ui/charts/horizontal-bar-chart.component';
import { environment } from '../../../environments/environment';

type IncidentsResponse = CollectionResponse<BehaviorIncident>;

type RangeOption = {
  value: 7 | 14 | 30;
  label: string;
};

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CardComponent,
    SkeletonComponent,
    BarChartComponent,
    DonutChartComponent,
    HorizontalBarChartComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <!-- Header with date range selector -->
      <div class="header">
        <h1>Analytics</h1>
        <p class="subtitle">Behavior incident trends and patterns</p>
      </div>

      <div class="context-bar">
        <span class="context-label">Showing last</span>
        <div class="range-buttons" role="group" aria-label="Date range">
          @for (option of rangeOptions; track option.value) {
            <button
              type="button"
              class="range-button"
              [class.active]="rangeDays() === option.value"
              (click)="setRange(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </div>

      @if (incidentsResource.isLoading()) {
        <!-- Loading state -->
        <app-card>
          <app-skeleton width="100%" height="200px" />
        </app-card>
      } @else if (incidentsResource.error()) {
        <!-- Error state -->
        <app-card>
          <p class="error" role="alert">Unable to load analytics data.</p>
        </app-card>
      } @else if (totalIncidents() === 0) {
        <!-- Empty state -->
        <app-card>
          <div class="empty-state">
            <p class="empty-title">No incidents recorded</p>
            <p class="empty-description">
              Record behavior incidents to see analytics and insights.
            </p>
          </div>
        </app-card>
      } @else {
        <!-- Summary Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ totalIncidents() }}</div>
            <div class="stat-label">Total Incidents</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ averagePerDay() }}</div>
            <div class="stat-label">Avg per Day</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ mostCommonFunction() }}</div>
            <div class="stat-label">Most Common</div>
          </div>
        </div>

        <!-- Frequency Chart -->
        <app-card>
          <h2>Incident Frequency</h2>
          <p class="chart-description">Daily incident count over the last {{ rangeDays() }} days</p>
          <app-bar-chart [data]="incidentsByDate()" />
        </app-card>

        <!-- Function Breakdown Chart -->
        <app-card>
          <h2>Behavior Function Breakdown</h2>
          <p class="chart-description">Distribution of incidents by behavioral function</p>
          <app-donut-chart [data]="incidentsByFunction()" />
        </app-card>

        <!-- Top Places Chart -->
        <app-card>
          <h2>Top Places</h2>
          <p class="chart-description">Locations where incidents occur most frequently</p>
          <app-horizontal-bar-chart [data]="incidentsByPlace()" />
        </app-card>

        <!-- Time of Day Chart -->
        <app-card>
          <h2>Time of Day</h2>
          <p class="chart-description">When incidents occur throughout the day</p>
          <app-horizontal-bar-chart [data]="incidentsByTimeOfDay()" />
        </app-card>
      }
    </div>
  `,
  styles: [`
    .layout {
      display: grid;
      gap: var(--space-4);
      padding-bottom: var(--space-6);
    }

    .header {
      display: grid;
      gap: var(--space-1);
    }

    h1 {
      margin: 0;
      font-size: var(--font-size-xl);
      font-weight: 600;
      color: var(--color-gray-900);
    }

    .subtitle {
      margin: 0;
      color: var(--color-gray-600);
      font-size: var(--font-size-sm);
    }

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

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: var(--space-3);
    }

    .stat-card {
      background: var(--color-white);
      border: 1px solid var(--color-gray-200);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .stat-value {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--color-gray-900);
    }

    .stat-label {
      font-size: var(--font-size-xs);
      color: var(--color-gray-600);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    h2 {
      margin: 0 0 var(--space-1);
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--color-gray-900);
    }

    .chart-description {
      margin: 0 0 var(--space-4);
      color: var(--color-gray-600);
      font-size: var(--font-size-sm);
    }

    .error {
      margin: 0;
      color: var(--color-error);
      font-weight: 600;
    }

    .empty-state {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-8) var(--space-4);
      text-align: center;
    }

    .empty-title {
      margin: 0;
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--color-gray-900);
    }

    .empty-description {
      margin: 0;
      color: var(--color-gray-600);
      font-size: var(--font-size-sm);
    }
  `]
})
export class AnalyticsComponent {
  private readonly participants = inject(ParticipantService);

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly rangeDays = signal<7 | 14 | 30>(30);
  readonly rangeOptions: RangeOption[] = [
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' }
  ];

  readonly incidentsResource = httpResource<IncidentsResponse>(() => {
    const participantId = this.activeParticipantId();
    const range = this.rangeDays();
    const toUtc = new Date().toISOString();
    const fromUtc = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();

    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/incidents`,
        method: 'GET',
        params: { pageSize: '1', fromUtc, toUtc }
      };
    }

    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/incidents`,
      method: 'GET',
      params: { pageSize: '1000', fromUtc, toUtc }
    };
  });

  readonly incidents = computed(() =>
    this.incidentsResource.hasValue() ? this.incidentsResource.value().items : []
  );

  readonly totalIncidents = computed(() => this.incidents().length);

  // Date range for filling in missing dates
  readonly dateRange = computed(() => {
    const range = this.rangeDays();
    const dates: string[] = [];
    const today = new Date();

    for (let i = range - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(dateStr);
    }

    return dates;
  });

  // 1. Incidents by date (for frequency bar chart)
  readonly incidentsByDate = computed(() => {
    const incidents = this.incidents();
    const counts = new Map<string, number>();

    for (const inc of incidents) {
      counts.set(inc.logLocalDate, (counts.get(inc.logLocalDate) ?? 0) + 1);
    }

    // Fill in missing dates with 0
    return this.dateRange().map(date => ({
      label: date,
      value: counts.get(date) ?? 0
    }));
  });

  // 2. Incidents by function (for donut chart)
  readonly incidentsByFunction = computed(() => {
    const incidents = this.incidents();
    const counts = { sensory: 0, tangible: 0, escape: 0, attention: 0 };

    for (const inc of incidents) {
      counts[inc.function]++;
    }

    return [
      { label: 'Sensory', value: counts.sensory, color: '#3b82f6' },
      { label: 'Tangible', value: counts.tangible, color: '#22c55e' },
      { label: 'Escape', value: counts.escape, color: '#ef4444' },
      { label: 'Attention', value: counts.attention, color: '#eab308' }
    ];
  });

  // 3. Incidents by place (for top places horizontal bar)
  readonly incidentsByPlace = computed(() => {
    const incidents = this.incidents();
    const counts = new Map<string, number>();

    for (const inc of incidents) {
      const place = inc.placeChip || inc.place || 'Unknown';
      counts.set(place, (counts.get(place) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 places
  });

  // 4. Incidents by time of day (for time-of-day horizontal bar)
  readonly incidentsByTimeOfDay = computed(() => {
    const incidents = this.incidents();
    const periods = { morning: 0, afternoon: 0, evening: 0, night: 0 };

    for (const inc of incidents) {
      const hour = parseInt(inc.logLocalTime.split(':')[0], 10);
      if (hour >= 5 && hour < 12) periods.morning++;
      else if (hour >= 12 && hour < 17) periods.afternoon++;
      else if (hour >= 17 && hour < 21) periods.evening++;
      else periods.night++;
    }

    return [
      { label: 'Morning', value: periods.morning },
      { label: 'Afternoon', value: periods.afternoon },
      { label: 'Evening', value: periods.evening },
      { label: 'Night', value: periods.night }
    ];
  });

  // Summary stats
  readonly averagePerDay = computed(() => {
    const total = this.totalIncidents();
    const days = this.rangeDays();
    return (total / days).toFixed(1);
  });

  readonly mostCommonFunction = computed(() => {
    const functionData = this.incidentsByFunction();
    const nonZero = functionData.filter(f => f.value > 0);

    if (nonZero.length === 0) return 'N/A';

    const max = nonZero.reduce((prev, current) =>
      current.value > prev.value ? current : prev
    );

    return max.label;
  });

  setRange(value: 7 | 14 | 30) {
    this.rangeDays.set(value);
  }
}
