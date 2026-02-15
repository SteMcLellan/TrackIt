import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorIncident } from '../../shared/models/behavior-incident';
import { CollectionResponse } from '../../shared/models/collection';
import { MedicationLog } from '../../shared/models/medication-log';
import { Medication } from '../../shared/models/medication';
import { Participant } from '../../shared/models/participant';
import { DailyReflectionSummaryResponse, MetricSummary } from '../../shared/models/daily-reflection';
import { AuthService } from '../../shared/services/auth.service';
import { ParticipantService } from '../../shared/services/participant.service';
import { environment } from '../../../environments/environment';

type ParticipantsResponse = CollectionResponse<Participant>;
type MedicationsResponse = CollectionResponse<Medication>;
type MedicationLogsResponse = CollectionResponse<MedicationLog>;
type IncidentsResponse = CollectionResponse<BehaviorIncident>;

type MedicationFrequency =
  | 'once-daily'
  | 'twice-daily'
  | 'three-times-daily'
  | 'as-needed';

type MedicationWithFrequency = Medication & {
  frequency?: MedicationFrequency;
  frequencyText?: string;
};

type WeeklyMetricKey = 'mood' | 'focus' | 'sleep' | 'energy';

type WeeklyMetricCard = {
  key: WeeklyMetricKey;
  label: string;
  icon: string;
  scoreLabel: string;
  path: string;
};

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/e78a1a0531dc47e49bc20cf32001380c
 * @stitch-screen-title Parental Insight Dashboard
 * @stitch-status converted
 * @stitch-last-sync 2026-02-13
 */
@Component({
  selector: 'app-insights-dashboard',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <section class="hero">
        <h1>
          Hi {{ caregiverName() }}, <span class="violet">{{ participantName() }}</span> is
          <span class="emerald">thriving</span>.
        </h1>
        <p>Weekly summary and today's rhythm.</p>
      </section>

      <section class="reflection-entry">
        <a class="reflection-button" routerLink="/daily-reflection">
          <span class="left">
            <span class="title">Daily Reflection</span>
            <span class="subtitle">Capture today's rhythm in under a minute.</span>
          </span>
          <span class="material-symbols-outlined chevron">arrow_forward_ios</span>
        </a>
      </section>

      <section class="section">
        <header class="section-header">
          <div class="section-title-group">
            <h2>Weekly Rhythms</h2>
            <a class="inline-link" routerLink="/daily-reflection">Open Daily Reflection</a>
          </div>
          <span class="range-label">Last 7 Days</span>
        </header>

        @if (summaryResource.isLoading()) {
          <div class="metrics-grid" aria-label="Loading weekly rhythm cards">
            @for (metric of metricSkeleton; track metric) {
              <div class="metric-card skeleton"></div>
            }
          </div>
        } @else if (summaryResource.error()) {
          <p class="error">Unable to load weekly rhythms right now.</p>
        } @else {
          <div class="metrics-grid">
            @for (metric of weeklyMetrics(); track metric.key) {
              <article
                class="metric-card"
                [class.mood]="metric.key === 'mood'"
                [class.focus]="metric.key === 'focus'"
                [class.sleep]="metric.key === 'sleep'"
                [class.energy]="metric.key === 'energy'"
              >
                <div class="metric-head">
                  <p>{{ metric.label }}</p>
                  <span class="material-symbols-outlined">{{ metric.icon }}</span>
                </div>
                <p class="metric-value">{{ metric.scoreLabel }}</p>
                <svg viewBox="0 0 100 40" aria-hidden="true">
                  <path [attr.d]="metric.path"></path>
                </svg>
              </article>
            }
          </div>
        }
      </section>

      <section class="section">
        <div class="med-summary-card" routerLink="/medications">
          <div class="med-summary-ring-group">
            <div class="med-summary-ring">
              <svg viewBox="0 0 36 36">
                <circle class="ring-bg" cx="18" cy="18" r="16" />
                @if (adherenceStatus() === 'pending') {
                  <circle class="ring-amber" cx="18" cy="18" r="16" stroke-dasharray="100 100" />
                }
                <circle class="ring-emerald" cx="18" cy="18" r="16"
                  [attr.stroke-dasharray]="progressDasharray()" />
              </svg>
              <span class="material-symbols-outlined ring-icon">pill</span>
            </div>
            <div class="med-summary-copy">
              <p class="med-summary-title">Today's Medications</p>
              @if (medicationSummary().totalExpectedDoses === 0) {
                <p class="med-summary-fraction">No scheduled doses today</p>
              } @else {
                <p class="med-summary-fraction">
                  {{ medicationSummary().takenDoses }} of {{ medicationSummary().totalExpectedDoses }} doses taken
                </p>
              }
              @if (adherenceStatus() === 'pending' && medicationSummary().pendingNames.length > 0) {
                <p class="med-summary-pending">
                  {{ medicationSummary().pendingNames[0] }} pending
                </p>
              }
            </div>
          </div>
          <div class="med-summary-trailing">
            @if (adherenceStatus() === 'complete') {
              <span class="med-chip complete">All on track</span>
            } @else if (adherenceStatus() === 'pending') {
              <span class="med-chip pending">
                {{ medicationSummary().totalExpectedDoses - medicationSummary().takenDoses }} remaining
              </span>
            } @else {
              <span class="med-chip none">None scheduled</span>
            }
            <span class="material-symbols-outlined med-chevron">chevron_right</span>
          </div>
        </div>
      </section>

      <section class="reflection-entry">
        <a class="reflection-button" routerLink="/behavioral-moments/new">
          <span class="left">
            <span class="title">Log a Moment</span>
            <span class="subtitle">Record what happened, when, and why.</span>
          </span>
          <span class="material-symbols-outlined chevron">arrow_forward_ios</span>
        </a>
      </section>

      <section class="section behavior">
        <header class="section-header">
          <h2>Behavioral Moments</h2>
          <a class="inline-link violet-link" routerLink="/timeline">View History</a>
        </header>
        @if (incidentsResource.isLoading()) {
          <div class="behavior-empty">Loading latest behavioral moment...</div>
        } @else if (latestIncident(); as incident) {
          <article class="incident-card">
            <div class="incident-head">
              <span class="function-chip">{{ formatFunction(incident.function) }}</span>
              <span class="incident-time">{{ incidentRecencyLabel(incident) }}</span>
            </div>
            <div class="abc-list">
              <div class="abc-row">
                <div class="abc-badge a">A</div>
                <div>
                  <p class="abc-label">Antecedent</p>
                  <p class="abc-copy">{{ incident.antecedent }}</p>
                </div>
              </div>
              <div class="abc-row">
                <div class="abc-badge b">B</div>
                <div>
                  <p class="abc-label">Behavior</p>
                  <p class="abc-copy">{{ incident.behavior }}</p>
                </div>
              </div>
              <div class="abc-row">
                <div class="abc-badge c">C</div>
                <div>
                  <p class="abc-label">Consequence</p>
                  <p class="abc-copy">{{ incident.consequence }}</p>
                </div>
              </div>
            </div>
          </article>
        } @else {
          <div class="behavior-empty">No behavioral moments recorded recently.</div>
        }
      </section>
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
      padding: 0 1.5rem 12rem;
      box-sizing: border-box;
      overflow-x: hidden;
      background: var(--color-ghost-white-canvas, #fcfcfd);
    }

    .hero {
      padding: 1.75rem 0 0.75rem;
    }

    .hero h1 {
      margin: 0;
      color: #0f172a;
      font-size: 1.95rem;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }

    .hero p {
      margin: 0.5rem 0 0;
      color: #64748b;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .violet {
      color: var(--color-electric-violet, #8b5cf6);
    }

    .emerald {
      color: var(--color-vital-emerald, #10b981);
    }

    .reflection-entry {
      padding: 0.625rem 0 0;
    }

    .reflection-button {
      min-height: 64px;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 1rem;
      border-radius: 0.625rem;
      border: 1px solid #f1f5f9;
      background: #fff;
      box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.05);
      text-decoration: none;
    }

    .reflection-button .left {
      display: grid;
      gap: 0.2rem;
    }

    .reflection-button .title {
      color: var(--color-midnight-slate, #1e293b);
      font-size: 1rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .reflection-button .subtitle {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 500;
      line-height: 1.4;
    }

    .chevron {
      color: var(--color-signal-blue, #137fec);
      font-size: 1rem;
      flex-shrink: 0;
    }

    .section {
      padding-top: 1.5rem;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.875rem;
    }

    .section-title-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    h2 {
      margin: 0;
      color: #94a3b8;
      font-size: 0.6875rem;
      font-weight: 700;
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: 0.15em;
    }

    .inline-link {
      color: var(--color-signal-blue, #137fec);
      font-size: 0.625rem;
      font-weight: 700;
      text-decoration: none;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
    }

    .violet-link {
      color: var(--color-electric-violet, #8b5cf6);
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .range-label {
      color: #94a3b8;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      white-space: nowrap;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.875rem;
    }

    .metric-card {
      border-radius: 1.5rem;
      border: 1px solid transparent;
      padding: 0.95rem 0.9rem;
      display: grid;
      gap: 0.5rem;
      min-height: 132px;
    }

    .metric-card svg {
      width: 100%;
      height: 2.5rem;
      overflow: visible;
    }

    .metric-card path {
      fill: none;
      stroke: currentColor;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .metric-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .metric-head p {
      margin: 0;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .metric-head .material-symbols-outlined {
      font-size: 1.125rem;
    }

    .metric-value {
      margin: 0;
      color: #0f172a;
      font-size: 1.125rem;
      font-weight: 700;
      line-height: 1.1;
    }

    .metric-card.mood {
      background: #f5f3ff;
      border-color: rgba(139, 92, 246, 0.32);
      color: #8b5cf6;
    }

    .metric-card.focus {
      background: #ecfdf5;
      border-color: rgba(16, 185, 129, 0.32);
      color: #10b981;
    }

    .metric-card.sleep {
      background: #f0f9ff;
      border-color: rgba(14, 165, 233, 0.32);
      color: #0ea5e9;
    }

    .metric-card.energy {
      background: #fffbeb;
      border-color: rgba(245, 158, 11, 0.32);
      color: #f59e0b;
    }

    .metric-card.skeleton {
      background: #fff;
      border-color: #e2e8f0;
      min-height: 132px;
      animation: pulse 1.4s ease-in-out infinite;
    }

    /* Medication summary card */

    .med-summary-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-radius: 0.5rem;
      background: #fff;
      border: 1px solid #f1f5f9;
      box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.04);
      cursor: pointer;
      text-decoration: none;
    }

    .med-summary-ring-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
      flex: 1;
    }

    .med-summary-ring {
      position: relative;
      width: 40px;
      height: 40px;
      flex-shrink: 0;
    }

    .med-summary-ring svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .med-summary-ring circle {
      fill: none;
      stroke-width: 3;
      stroke-linecap: round;
    }

    .ring-bg {
      stroke: #e2e8f0;
    }

    .ring-amber {
      stroke: #f59e0b;
    }

    .ring-emerald {
      stroke: #10b981;
    }

    .ring-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 1rem;
      color: #64748b;
      line-height: 1;
    }

    .med-summary-copy {
      min-width: 0;
      display: grid;
      gap: 0.1rem;
    }

    .med-summary-title {
      margin: 0;
      color: #1f2937;
      font-size: 0.9375rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .med-summary-fraction {
      margin: 0;
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 500;
      line-height: 1.3;
    }

    .med-summary-pending {
      margin: 0;
      color: #94a3b8;
      font-size: 0.6875rem;
      font-weight: 600;
      line-height: 1.3;
    }

    .med-summary-trailing {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-shrink: 0;
    }

    .med-chip {
      border-radius: 999px;
      border: 1px solid transparent;
      padding: 0.2rem 0.5rem;
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }

    .med-chip.complete {
      color: #10b981;
      background: #ecfdf5;
      border-color: rgba(16, 185, 129, 0.3);
    }

    .med-chip.pending {
      color: #f59e0b;
      background: #fffbeb;
      border-color: rgba(245, 158, 11, 0.3);
    }

    .med-chip.none {
      color: #94a3b8;
      background: #f8fafc;
      border-color: #e2e8f0;
    }

    .med-chevron {
      color: #cbd5e1;
      font-size: 1.125rem;
      line-height: 1;
    }

    /* Behavioral moments */

    .incident-card {
      border-radius: 2rem;
      border: 1px solid #f8fafc;
      background: #fff;
      box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      padding: 1.1rem 1.2rem;
      display: grid;
      gap: 0.9rem;
    }

    .incident-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .function-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      border: 1px solid rgba(139, 92, 246, 0.32);
      background: #f5f3ff;
      color: #8b5cf6;
      font-size: 0.56rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 0.28rem 0.56rem;
    }

    .incident-time {
      color: #94a3b8;
      font-size: 0.625rem;
      font-weight: 600;
    }

    .abc-list {
      display: grid;
      gap: 0.8rem;
    }

    .abc-row {
      display: flex;
      gap: 0.65rem;
      align-items: flex-start;
    }

    .abc-badge {
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.625rem;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 0.05rem;
    }

    .abc-badge.a {
      background: #f5f3ff;
      color: #8b5cf6;
    }

    .abc-badge.b {
      background: #ecfdf5;
      color: #10b981;
    }

    .abc-badge.c {
      background: #fffbeb;
      color: #f59e0b;
    }

    .abc-label {
      margin: 0;
      color: #94a3b8;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .abc-copy {
      margin: 0.2rem 0 0;
      color: #475569;
      font-size: 0.75rem;
      line-height: 1.4;
    }

    .error {
      margin: 0;
      color: #b91c1c;
      font-size: 0.8125rem;
      font-weight: 600;
      line-height: 1.45;
    }

    .behavior-empty {
      border-radius: 1rem;
      border: 1px dashed #cbd5e1;
      padding: 1rem;
      color: #64748b;
      font-size: 0.8125rem;
      background: #fff;
    }

    @keyframes pulse {
      0% { opacity: 0.65; }
      50% { opacity: 1; }
      100% { opacity: 0.65; }
    }
  `]
})
export class InsightsDashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly participantService = inject(ParticipantService);

  readonly caregiverName = computed(() => this.firstName(this.auth.appUser().name) || 'there');
  readonly activeParticipantId = this.participantService.activeParticipantId;
  readonly todayLocalDate = signal(this.formatLocalDate(new Date()));
  readonly metricSkeleton = [1, 2, 3, 4];

  readonly participantsResource = httpResource<ParticipantsResponse>(() => ({
    url: `${environment.apiBaseUrl}/participants`,
    method: 'GET',
    params: { pageSize: '200' }
  }));

  readonly summaryResource = httpResource<DailyReflectionSummaryResponse>(() => {
    const participantId = this.activeParticipantId();
    const endDate = this.todayLocalDate();
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/daily-reflections/summary`,
        method: 'GET',
        params: { endDate, days: '7' }
      };
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/daily-reflections/summary`,
      method: 'GET',
      params: { endDate, days: '7' }
    };
  });

  readonly medicationsResource = httpResource<MedicationsResponse>(() => {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/medications`,
        method: 'GET',
        params: { pageSize: '1' }
      };
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/medications`,
      method: 'GET',
      params: { pageSize: '200' }
    };
  });

  readonly logsResource = httpResource<MedicationLogsResponse>(() => {
    const participantId = this.activeParticipantId();
    const startDate = this.todayLocalDate();
    const endDate = this.todayLocalDate();
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/medication-logs`,
        method: 'GET',
        params: { startDate, endDate, pageSize: '1' }
      };
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/medication-logs`,
      method: 'GET',
      params: { startDate, endDate, pageSize: '300' }
    };
  });

  readonly incidentsResource = httpResource<IncidentsResponse>(() => {
    const participantId = this.activeParticipantId();
    const toUtc = new Date().toISOString();
    const fromUtc = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
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
      params: { pageSize: '20', fromUtc, toUtc }
    };
  });

  readonly participants = computed(() =>
    this.participantsResource.hasValue() ? this.participantsResource.value().items : []
  );

  readonly medications = computed(() =>
    this.medicationsResource.hasValue() ? this.medicationsResource.value().items : []
  );

  readonly logs = computed(() =>
    this.logsResource.hasValue() ? this.logsResource.value().items : []
  );

  readonly incidents = computed(() =>
    this.incidentsResource.hasValue() ? this.incidentsResource.value().items : []
  );

  readonly participantName = computed(() => {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return 'your participant';
    }
    const participant = this.participants().find((item) => item.id === participantId);
    return participant?.displayName || 'your participant';
  });

  readonly routineMedications = computed(() => {
    const today = this.todayLocalDate();
    return this.medications()
      .filter((item) => !item.archivedAtUtc)
      .filter((item) => item.startDateUtc <= today)
      .filter((item) => !item.endDateUtc || item.endDateUtc >= today);
  });

  readonly todayLogs = computed(() =>
    this.logs().filter((log) => log.logLocalDate === this.todayLocalDate())
  );

  readonly medicationSummary = computed(() => {
    let totalExpectedDoses = 0;
    let takenDoses = 0;
    const pendingNames: string[] = [];

    for (const med of this.routineMedications()) {
      const frequency = this.resolveMedicationFrequency(med);
      if (!frequency || frequency === 'as-needed') continue;

      const expectedSlots = this.frequencySlotCount(frequency);
      totalExpectedDoses += expectedSlots;

      const medLogs = this.todayLogs().filter(
        log => log.medicationId === med.id && log.status === 'taken'
      );
      const takenForMed = Math.min(medLogs.length, expectedSlots);
      takenDoses += takenForMed;

      if (takenForMed < expectedSlots) {
        pendingNames.push(med.name);
      }
    }

    return { totalExpectedDoses, takenDoses, pendingNames };
  });

  readonly progressPercent = computed(() => {
    const { totalExpectedDoses, takenDoses } = this.medicationSummary();
    if (totalExpectedDoses === 0) return 100;
    return Math.round((takenDoses / totalExpectedDoses) * 100);
  });

  readonly progressDasharray = computed(() => {
    const pct = this.progressPercent();
    return `${pct} 100`;
  });

  readonly adherenceStatus = computed<'complete' | 'pending' | 'none'>(() => {
    const { totalExpectedDoses, takenDoses } = this.medicationSummary();
    if (totalExpectedDoses === 0) return 'none';
    return takenDoses >= totalExpectedDoses ? 'complete' : 'pending';
  });

  readonly latestIncident = computed(() => {
    const sorted = [...this.incidents()].sort((a, b) => b.occurredAtUtc.localeCompare(a.occurredAtUtc));
    return sorted[0] ?? null;
  });

  readonly weeklyMetrics = computed<WeeklyMetricCard[]>(() => {
    if (!this.summaryResource.hasValue()) {
      return this.defaultMetricCards();
    }
    const summary = this.summaryResource.value();
    return [
      this.buildMetricCard('mood', 'Mood', 'sentiment_satisfied', summary.mood),
      this.buildMetricCard('focus', 'Focus', 'center_focus_strong', summary.focus),
      this.buildMetricCard('sleep', 'Sleep', 'bedtime', summary.sleep),
      this.buildMetricCard('energy', 'Energy', 'bolt', summary.energy)
    ];
  });

  formatFunction(value: string): string {
    return value.replace(/_/g, ' ');
  }

  incidentRecencyLabel(incident: BehaviorIncident): string {
    const today = this.todayLocalDate();
    const time = this.formatTimeLabel(incident.logLocalTime);
    if (incident.logLocalDate === today) {
      return `Today - ${time}`;
    }
    return `${incident.logLocalDate} - ${time}`;
  }

  private frequencySlotCount(frequency: MedicationFrequency): number {
    if (frequency === 'once-daily') return 1;
    if (frequency === 'twice-daily') return 2;
    if (frequency === 'three-times-daily') return 3;
    return 0;
  }

  private resolveMedicationFrequency(medication: Medication): MedicationFrequency | null {
    const withFrequency = medication as MedicationWithFrequency;
    const frequency = withFrequency.frequency;
    if (
      frequency === 'once-daily' ||
      frequency === 'twice-daily' ||
      frequency === 'three-times-daily' ||
      frequency === 'as-needed'
    ) {
      return frequency;
    }

    const frequencyText = withFrequency.frequencyText?.trim().toLowerCase();
    if (!frequencyText) {
      return null;
    }
    if (frequencyText.includes('as-needed') || frequencyText.includes('as needed')) return 'as-needed';
    if (frequencyText.includes('three')) return 'three-times-daily';
    if (frequencyText.includes('twice') || frequencyText.includes('2')) return 'twice-daily';
    if (frequencyText.includes('once') || frequencyText.includes('daily')) return 'once-daily';
    return null;
  }

  private buildMetricCard(
    key: WeeklyMetricKey,
    label: string,
    icon: string,
    summary: MetricSummary
  ): WeeklyMetricCard {
    const points = summary.points.map((point) => point.score);
    return {
      key,
      label,
      icon,
      scoreLabel: this.metricDescriptor(key, summary.latestScore),
      path: this.buildSparklinePath(points)
    };
  }

  private defaultMetricCards(): WeeklyMetricCard[] {
    const flatPath = this.buildSparklinePath([]);
    return [
      { key: 'mood', label: 'Mood', icon: 'sentiment_satisfied', scoreLabel: 'No Data', path: flatPath },
      { key: 'focus', label: 'Focus', icon: 'center_focus_strong', scoreLabel: 'No Data', path: flatPath },
      { key: 'sleep', label: 'Sleep', icon: 'bedtime', scoreLabel: 'No Data', path: flatPath },
      { key: 'energy', label: 'Energy', icon: 'bolt', scoreLabel: 'No Data', path: flatPath }
    ];
  }

  private metricDescriptor(metric: WeeklyMetricKey, score: number | null): string {
    if (score === null) {
      return 'No Data';
    }
    if (metric === 'mood') {
      if (score < 34) return 'Withdrawn';
      if (score < 67) return 'Balanced';
      return 'Vibrant';
    }
    if (metric === 'focus') {
      if (score < 34) return 'Redirecting';
      if (score < 67) return 'Building';
      return 'Steady';
    }
    if (metric === 'sleep') {
      if (score < 34) return 'Fragmented';
      if (score < 67) return 'Settling';
      return 'Restful';
    }
    if (score < 34) return 'Low Drive';
    if (score < 67) return 'Balanced';
    return 'Active';
  }

  private buildSparklinePath(points: Array<number | null>): string {
    const resolved = points.length > 0 ? points : [50, 50, 50, 50];
    const transformed = resolved.map((value) => value ?? 50);
    if (transformed.length === 1) {
      const y = this.scoreToY(transformed[0]);
      return `M0,${y} L100,${y}`;
    }
    return transformed
      .map((value, index) => {
        const x = (index / (transformed.length - 1)) * 100;
        const y = this.scoreToY(value);
        return `${index === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  }

  private scoreToY(score: number): number {
    return Number((35 - (score / 100) * 24).toFixed(2));
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTimeLabel(value?: string): string {
    if (!value) {
      return 'Time n/a';
    }
    const [hourRaw, minuteRaw] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return value;
    }
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
  }

  private firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? '';
  }
}
