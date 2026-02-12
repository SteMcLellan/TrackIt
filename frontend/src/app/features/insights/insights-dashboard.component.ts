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
import { MedicationLogService } from '../../shared/services/medication-log.service';
import { ParticipantService } from '../../shared/services/participant.service';
import { environment } from '../../../environments/environment';

type ParticipantsResponse = CollectionResponse<Participant>;
type MedicationsResponse = CollectionResponse<Medication>;
type MedicationLogsResponse = CollectionResponse<MedicationLog>;
type IncidentsResponse = CollectionResponse<BehaviorIncident>;

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
 * @stitch-screen projects/2002730124455423542/screens/efcaceb73e4746e2a655f9d447f9f420
 * @stitch-screen-title Parental Insight Dashboard
 * @stitch-status converted
 * @stitch-last-sync 2026-02-12
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
        <p>Weekly summary and today's routine.</p>
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
        <header class="section-header">
          <h2>Today's Routine</h2>
        </header>
        @if (routineError()) {
          <p class="error">{{ routineError() }}</p>
        }
        <div class="routine-card">
          @if (medicationsResource.isLoading() || logsResource.isLoading()) {
            <div class="routine-empty">Loading today's medication routine...</div>
          } @else if (routineMedications().length === 0) {
            <div class="routine-empty">No active medications scheduled today.</div>
          } @else {
            @for (medication of routineMedications(); track medication.id; let index = $index) {
              <article class="routine-row">
                <div class="medication-meta">
                  <div class="medication-icon" [class.alt]="index % 2 === 1">
                    <span class="material-symbols-outlined">
                      {{ index % 2 === 0 ? 'wb_sunny' : 'wb_twilight' }}
                    </span>
                  </div>
                  <div class="medication-copy">
                    <p class="medication-title">{{ medication.name }}</p>
                    <p class="medication-subtitle">
                      {{ medication.dosageText }} • {{ medication.frequencyText }}
                    </p>
                  </div>
                </div>
                @switch (logStatus(medication.id)) {
                  @case ('taken') {
                    <button
                      class="status-button taken"
                      type="button"
                      [disabled]="isSaving(medication.id)"
                      (click)="markMedication(medication, 'not_taken')"
                    >
                      Taken
                    </button>
                  }
                  @case ('not_taken') {
                    <button
                      class="status-button skipped"
                      type="button"
                      [disabled]="isSaving(medication.id)"
                      (click)="markMedication(medication, 'taken')"
                    >
                      Not Taken
                    </button>
                  }
                  @default {
                    <button
                      class="status-button pending"
                      type="button"
                      [disabled]="isSaving(medication.id)"
                      (click)="markMedication(medication, 'taken')"
                    >
                      Mark Taken
                    </button>
                  }
                }
              </article>
            }
          }
        </div>
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

      <div class="log-moment-wrap">
        <a class="log-moment-button" routerLink="/incidents/new">
          <span class="material-symbols-outlined">bolt</span>
          <span>Log Moment</span>
        </a>
      </div>
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

    .routine-card {
      border-radius: 2rem;
      border: 1px solid #f8fafc;
      background: #fff;
      padding: 1.2rem;
      box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.05);
      display: grid;
      gap: 1rem;
    }

    .routine-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .routine-row + .routine-row {
      border-top: 1px solid #f8fafc;
      padding-top: 1rem;
    }

    .medication-meta {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
    }

    .medication-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 1rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #10b981;
      background: #ecfdf5;
      flex-shrink: 0;
    }

    .medication-icon.alt {
      color: #f59e0b;
      background: #fffbeb;
    }

    .medication-copy {
      min-width: 0;
      display: grid;
      gap: 0.15rem;
    }

    .medication-title {
      margin: 0;
      color: #1f2937;
      font-size: 0.9375rem;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    .medication-subtitle {
      margin: 0;
      color: #94a3b8;
      font-size: 0.6875rem;
      font-weight: 500;
    }

    .status-button {
      min-height: 40px;
      border-radius: 999px;
      border: 2px solid transparent;
      padding: 0.45rem 0.95rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      cursor: pointer;
      max-width: 100%;
    }

    .status-button[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .status-button.pending {
      background: #10b981;
      color: #fff;
      border-color: #10b981;
    }

    .status-button.taken {
      background: #10b981;
      color: #fff;
      border-color: #10b981;
    }

    .status-button.skipped {
      background: #fff;
      color: #94a3b8;
      border-color: #f1f5f9;
    }

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

    .log-moment-wrap {
      position: fixed;
      left: 50%;
      bottom: calc(6.1rem + env(safe-area-inset-bottom, 0px));
      transform: translateX(-50%);
      width: min(100%, 28rem);
      padding: 0 1.5rem;
      box-sizing: border-box;
      z-index: 40;
      max-width: 100%;
    }

    .log-moment-button {
      min-height: 56px;
      width: 100%;
      border-radius: 1rem;
      background: #8b5cf6;
      box-shadow: 0 16px 30px -10px rgba(139, 92, 246, 0.45);
      color: #fff;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .error {
      margin: 0;
      color: #b91c1c;
      font-size: 0.8125rem;
      font-weight: 600;
      line-height: 1.45;
    }

    .routine-empty,
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
  private readonly medicationLogs = inject(MedicationLogService);

  readonly caregiverName = computed(() => this.firstName(this.auth.appUser().name) || 'there');
  readonly activeParticipantId = this.participantService.activeParticipantId;
  readonly todayLocalDate = signal(this.formatLocalDate(new Date()));
  readonly metricSkeleton = [1, 2, 3, 4];
  readonly savingMap = signal<Record<string, boolean>>({});
  readonly routineError = signal<string | null>(null);
  private readonly refreshTick = signal(0);

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
    this.refreshTick();
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
    this.refreshTick();
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

  readonly logs = computed(() => (this.logsResource.hasValue() ? this.logsResource.value().items : []));

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
      .filter((item) => !item.endDateUtc || item.endDateUtc >= today)
      .slice(0, 2);
  });

  readonly logStatusByMedicationId = computed(() => {
    const statusMap = new Map<string, 'taken' | 'not_taken'>();
    for (const log of this.logs()) {
      if (log.logLocalDate === this.todayLocalDate()) {
        statusMap.set(log.medicationId, log.status);
      }
    }
    return statusMap;
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

  logStatus(medicationId: string): 'taken' | 'not_taken' | null {
    return this.logStatusByMedicationId().get(medicationId) ?? null;
  }

  markMedication(medication: Medication, status: 'taken' | 'not_taken'): void {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return;
    }

    this.routineError.set(null);
    this.setSaving(medication.id, true);
    const logLocalDate = this.todayLocalDate();
    const logTzOffsetMinutes = -new Date().getTimezoneOffset();

    this.medicationLogs
      .upsertLog(participantId, medication.id, logLocalDate, {
        status,
        logTzOffsetMinutes,
        occurrenceKey: 'daily'
      })
      .subscribe({
        next: () => {
          this.setSaving(medication.id, false);
          this.refreshTick.update((value) => value + 1);
        },
        error: () => {
          this.setSaving(medication.id, false);
          this.routineError.set('Unable to update routine status. Please try again.');
        }
      });
  }

  isSaving(medicationId: string): boolean {
    return !!this.savingMap()[medicationId];
  }

  formatFunction(value: string): string {
    return value.replace(/_/g, ' ');
  }

  incidentRecencyLabel(incident: BehaviorIncident): string {
    const today = this.todayLocalDate();
    const time = this.formatTimeLabel(incident.logLocalTime);
    if (incident.logLocalDate === today) {
      return `Today • ${time}`;
    }
    return `${incident.logLocalDate} • ${time}`;
  }

  private setSaving(medicationId: string, value: boolean): void {
    this.savingMap.update((state) => ({ ...state, [medicationId]: value }));
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
