import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorIncident } from '../../shared/models/behavior-incident';
import { CollectionResponse } from '../../shared/models/collection';
import { MedicationLog } from '../../shared/models/medication-log';
import { Medication, MedicationFrequency } from '../../shared/models/medication';
import { Participant } from '../../shared/models/participant';
import { DailyReflectionSummaryResponse, MetricSummary } from '../../shared/models/daily-reflection';
import { HeroPhraseTier, HeroPhraseTiersDocument } from '../../shared/models/hero-phrase-tiers';
import { AuthService } from '../../shared/services/auth.service';
import { ParticipantService } from '../../shared/services/participant.service';
import { environment } from '../../../environments/environment';
import { formatLocalDate, formatTimeLabel } from '../../shared/utils/datetime';
import { FALLBACK_HERO_PHRASE_TIERS } from './hero-phrase-fallback-tiers';

type ParticipantsResponse = CollectionResponse<Participant>;
type MedicationsResponse = CollectionResponse<Medication>;
type MedicationLogsResponse = CollectionResponse<MedicationLog>;
type IncidentsResponse = CollectionResponse<BehaviorIncident>;

type IntervalDueState = 'early' | 'due' | 'overdue';

type WeeklyMetricKey = 'mood' | 'focus' | 'sleep' | 'energy';

type SwingMarker = { x: number; y: number };

type WeeklyMetricCard = {
  key: WeeklyMetricKey;
  label: string;
  icon: string;
  scoreLabel: string;
  path: string;
  rollingAveragePath: string;
  dataDots: Array<{ x: number; y: number }>;
  swingMarkers: SwingMarker[];
  referenceLineY: number | null;
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
        <p class="hero-context">Hi {{ caregiverName() }}</p>
        <h1>
          <span class="violet">{{ participantName() }}</span> {{ heroPhrase().suffix }}
        </h1>
        <p>{{ heroPhrase().subtext }}</p>
      </section>

      <section class="reflection-entry">
        @if (summaryResource.isLoading()) {
          <div class="reflection-button-skeleton skeleton"></div>
        } @else if (todayReflectionLogged()) {
          <a class="reflection-button reflection-logged" routerLink="/daily-reflection">
            <span class="left">
              <span class="title">Today's Reflection</span>
              <span class="subtitle logged-labels">{{ todayReflectionLabels() }}</span>
            </span>
            <span class="material-symbols-outlined chevron logged-chevron">arrow_forward_ios</span>
          </a>
        } @else {
          <a class="reflection-button" routerLink="/daily-reflection">
            <span class="left">
              <span class="title">How is {{ participantName() }} doing today?</span>
              <span class="subtitle">Log today's reflection</span>
            </span>
            <span class="reflection-cta"><span class="material-symbols-outlined">arrow_forward</span></span>
          </a>
        }
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
                  @if (metric.referenceLineY !== null) {
                    <line class="reference-line" x1="0" [attr.y1]="metric.referenceLineY" x2="100" [attr.y2]="metric.referenceLineY" />
                  }
                  <path [attr.d]="metric.path"></path>
                  @if (metric.rollingAveragePath) {
                    <path class="rolling-avg" [attr.d]="metric.rollingAveragePath"></path>
                  }
                  @for (dot of metric.dataDots; track $index) {
                    <circle class="data-dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="1.8" />
                  }
                  @for (marker of metric.swingMarkers; track $index) {
                    <polygon class="swing-marker" [attr.points]="swingDiamondPoints(marker.x, marker.y)" />
                  }
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
              @if (medicationSummary().totalExpectedDoses === 0 && medicationSummary().intervalActionableCount === 0) {
                <p class="med-summary-fraction">No scheduled doses today</p>
              } @else if (medicationSummary().totalExpectedDoses === 0) {
                <p class="med-summary-fraction">
                  {{ medicationSummary().intervalActionableCount }} interval medication{{ medicationSummary().intervalActionableCount === 1 ? '' : 's' }} due
                </p>
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
              @if (medicationSummary().nearestIntervalDueLabel) {
                <p class="med-summary-pending">
                  {{ medicationSummary().nearestIntervalDueLabel }}
                </p>
              }
            </div>
          </div>
          <div class="med-summary-trailing">
            @if (adherenceStatus() === 'complete' && medicationSummary().intervalActionableCount === 0) {
              <span class="med-chip complete">All on track</span>
            } @else if (adherenceStatus() === 'pending' || medicationSummary().intervalActionableCount > 0) {
              <span class="med-chip pending">
                {{ medicationSummary().totalExpectedDoses - medicationSummary().takenDoses + medicationSummary().intervalActionableCount }} remaining
              </span>
            } @else {
              <span class="med-chip none">None scheduled</span>
            }
            <span class="material-symbols-outlined med-chevron">chevron_right</span>
          </div>
        </div>
      </section>

      <section class="reflection-entry">
        <a class="reflection-button" routerLink="/incidents/new">
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
      background: var(--color-ghost-white-canvas, var(--color-ghost-white-canvas, #fcfcfd));
    }

    .hero {
      padding: 1.75rem 0 0.75rem;
    }

    .hero-context {
      margin: 0 0 5px;
      color: var(--color-text-muted, #64748b);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .hero h1 {
      margin: 0;
      color: #0f172a;
      font-size: 2.1rem;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.03em;
    }

    .hero p {
      margin: 0.5rem 0 0;
      color: var(--color-text-muted, #64748b);
      font-size: 0.875rem;
      font-weight: 500;
    }

    .violet {
      color: var(--color-electric-violet, var(--color-electric-violet, #8b5cf6));
    }

    .emerald {
      color: var(--color-vital-emerald, var(--color-vital-emerald, #10b981));
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
      color: var(--color-midnight-slate, var(--color-midnight-slate, #1e293b));
      font-size: 1rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .reflection-button .subtitle {
      color: var(--color-text-muted, #64748b);
      font-size: 0.75rem;
      font-weight: 500;
      line-height: 1.4;
    }

    .chevron {
      color: var(--color-signal-blue, #137fec);
      font-size: 1rem;
      flex-shrink: 0;
    }

    .reflection-cta {
      width: 32px;
      height: 32px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-vital-emerald) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-vital-emerald) 28%, transparent);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .reflection-cta .material-symbols-outlined {
      color: var(--color-vital-emerald, #10b981);
      font-size: 1rem;
    }

    .reflection-button-skeleton {
      height: 64px;
      border-radius: 0.625rem;
      animation: pulse 1.4s ease-in-out infinite;
    }

    .reflection-button.reflection-logged {
      background: var(--color-soft-emerald, #ecfdf5);
      border-color: color-mix(in srgb, var(--color-vital-emerald) 32%, transparent);
    }

    .reflection-button.reflection-logged .title {
      color: #065f46;
    }

    .logged-labels {
      color: #059669;
    }

    .logged-chevron {
      color: var(--color-vital-emerald, #10b981);
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
      color: var(--color-electric-violet, var(--color-electric-violet, #8b5cf6));
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
      min-height: 148px;
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

    .metric-card .reference-line {
      stroke: currentColor;
      stroke-width: 1;
      stroke-dasharray: 3 2;
      opacity: 0.35;
    }

    .metric-card .rolling-avg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-dasharray: 4 2;
      opacity: 0.55;
    }

    .metric-card .data-dot {
      fill: currentColor;
    }

    .metric-card .swing-marker {
      fill: #f97316;
      stroke: none;
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
      font-size: 1.65rem;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.03em;
    }

    .metric-card.mood {
      background: var(--color-soft-violet, #f5f3ff);
      border-color: color-mix(in srgb, var(--color-electric-violet) 32%, transparent);
      color: var(--color-electric-violet, #8b5cf6);
    }

    .metric-card.focus {
      background: var(--color-soft-emerald, #ecfdf5);
      border-color: color-mix(in srgb, var(--color-vital-emerald) 32%, transparent);
      color: var(--color-vital-emerald, #10b981);
    }

    .metric-card.sleep {
      background: var(--color-soft-azure, #f0f9ff);
      border-color: color-mix(in srgb, var(--color-sky-azure) 32%, transparent);
      color: var(--color-sky-azure, #0ea5e9);
    }

    .metric-card.energy {
      background: var(--color-soft-amber, #fffbeb);
      border-color: color-mix(in srgb, var(--color-energetic-amber) 32%, transparent);
      color: var(--color-energetic-amber, #f59e0b);
    }

    .metric-card.skeleton {
      background: #fff;
      border-color: var(--color-border, #e2e8f0);
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
      stroke: var(--color-border, #e2e8f0);
    }

    .ring-amber {
      stroke: var(--color-energetic-amber, #f59e0b);
    }

    .ring-emerald {
      stroke: var(--color-vital-emerald, #10b981);
    }

    .ring-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 1rem;
      color: var(--color-text-muted, #64748b);
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
      color: var(--color-text-muted, #64748b);
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
      color: var(--color-vital-emerald, #10b981);
      background: var(--color-soft-emerald, #ecfdf5);
      border-color: color-mix(in srgb, var(--color-vital-emerald) 30%, transparent);
    }

    .med-chip.pending {
      color: var(--color-energetic-amber, #f59e0b);
      background: var(--color-soft-amber, #fffbeb);
      border-color: color-mix(in srgb, var(--color-energetic-amber) 30%, transparent);
    }

    .med-chip.none {
      color: #94a3b8;
      background: #f8fafc;
      border-color: var(--color-border, #e2e8f0);
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
      border: 1px solid color-mix(in srgb, var(--color-electric-violet) 32%, transparent);
      background: var(--color-soft-violet, #f5f3ff);
      color: var(--color-electric-violet, #8b5cf6);
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
      background: var(--color-soft-violet, #f5f3ff);
      color: var(--color-electric-violet, #8b5cf6);
    }

    .abc-badge.b {
      background: var(--color-soft-emerald, #ecfdf5);
      color: var(--color-vital-emerald, #10b981);
    }

    .abc-badge.c {
      background: var(--color-soft-amber, #fffbeb);
      color: var(--color-energetic-amber, #f59e0b);
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
      color: var(--color-text-muted, #64748b);
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
  readonly todayLocalDate = signal(formatLocalDate(new Date()));
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

  readonly heroPhraseTiersResource = httpResource<HeroPhraseTiersDocument>(
    () => ({ url: `${environment.apiBaseUrl}/hero-phrase-tiers`, method: 'GET' })
  );

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
    const endDate = this.todayLocalDate();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const startDate = formatLocalDate(sevenDaysAgo);
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/incidents`,
        method: 'GET',
        params: { pageSize: '1', startDate, endDate }
      };
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/incidents`,
      method: 'GET',
      params: { pageSize: '20', startDate, endDate }
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
    let intervalActionableCount = 0;
    let intervalMedicationCount = 0;
    let nearestIntervalDeltaDays: number | null = null;
    const pendingNames: string[] = [];

    for (const med of this.routineMedications()) {
      const frequency = this.resolveMedicationFrequency(med);
      if (!frequency || frequency === 'as-needed') continue;

      if (frequency === 'interval-days') {
        intervalMedicationCount += 1;
        const nextDueLocalDate = this.intervalNextDueLocalDate(med);
        const intervalDeltaDays = nextDueLocalDate
          ? this.daysBetweenLocalDates(this.todayLocalDate(), nextDueLocalDate)
          : 0;
        if (
          intervalDeltaDays !== null
          && (
            nearestIntervalDeltaDays === null
            || this.isPreferredIntervalDelta(intervalDeltaDays, nearestIntervalDeltaDays)
          )
        ) {
          nearestIntervalDeltaDays = intervalDeltaDays;
        }

        const dueState = this.intervalDueState(med);
        if (dueState !== 'early') {
          intervalActionableCount += 1;
        }
        continue;
      }

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

    const nearestIntervalDueLabel = intervalMedicationCount > 0
      ? this.intervalLabelFromDeltaDays(nearestIntervalDeltaDays ?? 0)
      : null;

    return { totalExpectedDoses, takenDoses, intervalActionableCount, nearestIntervalDueLabel, pendingNames };
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

  readonly todayReflectionSummary = computed(() => {
    if (!this.summaryResource.hasValue()) {
      return { mood: null as number | null, focus: null as number | null, energy: null as number | null, sleep: null as number | null };
    }
    const summary = this.summaryResource.value()!;
    const today = this.todayLocalDate();
    const findScore = (metric: MetricSummary): number | null =>
      metric.points.find(p => p.logLocalDate === today)?.score ?? null;
    return {
      mood: findScore(summary.mood),
      focus: findScore(summary.focus),
      energy: findScore(summary.energy),
      sleep: findScore(summary.sleep)
    };
  });

  readonly todayReflectionLogged = computed(() => {
    const r = this.todayReflectionSummary();
    return r.mood !== null || r.focus !== null || r.energy !== null || r.sleep !== null;
  });

  readonly todayReflectionLabels = computed(() => {
    const r = this.todayReflectionSummary();
    const parts: string[] = [];
    if (r.mood !== null) parts.push(`Mood: ${this.metricDescriptor('mood', r.mood)}`);
    if (r.focus !== null) parts.push(`Focus: ${this.metricDescriptor('focus', r.focus)}`);
    if (r.energy !== null) parts.push(`Energy: ${this.metricDescriptor('energy', r.energy)}`);
    if (r.sleep !== null) parts.push(`Sleep: ${this.metricDescriptor('sleep', r.sleep)}`);
    return parts.join(' · ');
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

  readonly heroPhrase = computed<{ suffix: string; subtext: string }>(() => {
    if (this.summaryResource.isLoading()) {
      return { suffix: 'is thriving.', subtext: "Weekly summary and today's rhythm." };
    }

    const tiers: HeroPhraseTier[] = this.heroPhraseTiersResource.hasValue()
      ? this.heroPhraseTiersResource.value()!.tiers
      : FALLBACK_HERO_PHRASE_TIERS;

    const selectPhrase = (tier: HeroPhraseTier) => {
      const phrase = tier.phrases[this.dayOfYear(new Date()) % tier.phrases.length];
      return { suffix: phrase.headline.replace('{participant} ', ''), subtext: phrase.subtext };
    };

    if (!this.summaryResource.hasValue()) {
      const tier = tiers.find(t => t.condition === 'no-data') ?? tiers[0];
      return selectPhrase(tier);
    }

    const summary = this.summaryResource.value()!;
    const moodScore = summary.mood.latestScore;
    const focusScore = summary.focus.latestScore;
    const sleepScore = summary.sleep.latestScore;

    if (moodScore === null && focusScore === null && sleepScore === null) {
      const tier = tiers.find(t => t.condition === 'no-data') ?? tiers[0];
      return selectPhrase(tier);
    }

    const scores = [moodScore, focusScore, sleepScore].filter((s): s is number => s !== null);
    const composite = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    const tier = tiers.find(t => {
      if (typeof t.condition === 'string') return false;
      return composite >= t.condition.min && composite <= t.condition.max;
    }) ?? tiers.find(t => t.condition === 'no-data') ?? tiers[0];

    return selectPhrase(tier);
  });

  formatFunction(value: string): string {
    return value.replace(/_/g, ' ');
  }

  incidentRecencyLabel(incident: BehaviorIncident): string {
    const today = this.todayLocalDate();
    const time = formatTimeLabel(incident.logLocalTime);
    if (incident.logLocalDate === today) {
      return `Today - ${time}`;
    }
    return `${this.formatReadableDate(incident.logLocalDate)} - ${time}`;
  }

  private formatReadableDate(localDate: string): string {
    const [year, month, day] = localDate.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[month - 1]} ${day}, ${year}`;
  }

  private frequencySlotCount(frequency: MedicationFrequency): number {
    if (frequency === 'once-daily') return 1;
    if (frequency === 'twice-daily') return 2;
    if (frequency === 'three-times-daily') return 3;
    if (frequency === 'interval-days') return 1;
    return 0;
  }

  private resolveMedicationFrequency(medication: Medication): MedicationFrequency | null {
    return medication.frequency ?? null;
  }

  private intervalDueState(medication: Medication): IntervalDueState {
    const nextDueLocalDate = this.intervalNextDueLocalDate(medication);
    if (!nextDueLocalDate) {
      return 'due';
    }
    const deltaDays = this.daysBetweenLocalDates(this.todayLocalDate(), nextDueLocalDate);
    if (deltaDays === null) {
      return 'due';
    }
    if (deltaDays < 0) {
      return 'early';
    }
    if (deltaDays === 0) {
      return 'due';
    }
    return 'overdue';
  }

  private intervalLabelFromDeltaDays(deltaDays: number): string {
    if (deltaDays === 0) {
      return 'Next interval due today';
    }
    if (deltaDays < 0) {
      const days = Math.abs(deltaDays);
      return `Next interval due in ${days} day${days === 1 ? '' : 's'}`;
    }
    return `Next interval overdue by ${deltaDays} day${deltaDays === 1 ? '' : 's'}`;
  }

  private isPreferredIntervalDelta(candidateDelta: number, currentDelta: number): boolean {
    const candidateDistance = Math.abs(candidateDelta);
    const currentDistance = Math.abs(currentDelta);
    if (candidateDistance !== currentDistance) {
      return candidateDistance < currentDistance;
    }
    if (candidateDelta >= 0 && currentDelta < 0) {
      return true;
    }
    if (candidateDelta < 0 && currentDelta >= 0) {
      return false;
    }
    return candidateDelta > currentDelta;
  }

  private intervalNextDueLocalDate(medication: Medication): string | null {
    const schedule = medication.intervalSchedule;
    if (!schedule?.anchorDateLocal || typeof schedule.intervalDays !== 'number') {
      return null;
    }
    return this.addDaysToLocalDate(schedule.anchorDateLocal, schedule.intervalDays);
  }

  private addDaysToLocalDate(localDate: string, days: number): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      return null;
    }
    const [year, month, day] = localDate.split('-').map(Number);
    const utcValue = Date.UTC(year, month - 1, day) + days * 24 * 60 * 60 * 1000;
    const shifted = new Date(utcValue);
    const yyyy = shifted.getUTCFullYear();
    const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(shifted.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private daysBetweenLocalDates(a: string, b: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) {
      return null;
    }
    const [aYear, aMonth, aDay] = a.split('-').map(Number);
    const [bYear, bMonth, bDay] = b.split('-').map(Number);
    const utcA = Date.UTC(aYear, aMonth - 1, aDay);
    const utcB = Date.UTC(bYear, bMonth - 1, bDay);
    return Math.floor((utcA - utcB) / (1000 * 60 * 60 * 24));
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
      path: this.buildSparklinePath(points),
      rollingAveragePath: this.buildRollingAveragePath(points),
      dataDots: this.buildDataDots(points),
      swingMarkers: this.buildSwingMarkers(points),
      referenceLineY: key === 'energy' ? this.scoreToY(50) : null
    };
  }

  private defaultMetricCards(): WeeklyMetricCard[] {
    const flatPath = this.buildSparklinePath([]);
    return [
      { key: 'mood', label: 'Mood', icon: 'sentiment_satisfied', scoreLabel: 'No Data', path: flatPath, rollingAveragePath: '', dataDots: [], swingMarkers: [], referenceLineY: null },
      { key: 'focus', label: 'Focus', icon: 'center_focus_strong', scoreLabel: 'No Data', path: flatPath, rollingAveragePath: '', dataDots: [], swingMarkers: [], referenceLineY: null },
      { key: 'sleep', label: 'Sleep', icon: 'bedtime', scoreLabel: 'No Data', path: flatPath, rollingAveragePath: '', dataDots: [], swingMarkers: [], referenceLineY: null },
      { key: 'energy', label: 'Energy', icon: 'bolt', scoreLabel: 'No Data', path: flatPath, rollingAveragePath: '', dataDots: [], swingMarkers: [], referenceLineY: this.scoreToY(50) }
    ];
  }

  private metricDescriptor(metric: WeeklyMetricKey, score: number | null): string {
    if (score === null) {
      return 'No Data';
    }
    if (metric === 'mood') {
      if (score < 20) return 'Struggling';
      if (score < 40) return 'Irritable';
      if (score < 60) return 'Steady';
      if (score < 80) return 'Upbeat';
      return 'Thriving';
    }
    if (metric === 'focus') {
      if (score < 20) return 'Scattered';
      if (score < 40) return 'Drifting';
      if (score < 60) return 'Typical';
      if (score < 80) return 'Dialed In';
      return 'Locked In';
    }
    if (metric === 'sleep') {
      if (score < 20) return 'Rough Night';
      if (score < 40) return 'Restless';
      if (score < 60) return 'Fine';
      if (score < 80) return 'Solid';
      return 'Refreshed';
    }
    // energy
    if (score < 20) return 'Drained';
    if (score < 40) return 'Sluggish';
    if (score < 60) return 'Level';
    if (score < 80) return 'Buzzing';
    return 'Wired';
  }

  private buildSparklinePath(points: Array<number | null>): string {
    if (points.length === 0) {
      const y = this.scoreToY(50);
      return `M0,${y} L100,${y}`;
    }
    const n = points.length;
    const parts: string[] = [];
    let inSegment = false;
    for (let i = 0; i < n; i++) {
      const val = points[i];
      if (val === null) {
        inSegment = false;
        continue;
      }
      const x = n === 1 ? 50 : Number(((i / (n - 1)) * 100).toFixed(2));
      const y = this.scoreToY(val);
      if (!inSegment) {
        parts.push(`M${x},${y}`);
        inSegment = true;
      } else {
        parts.push(`L${x},${y}`);
      }
    }
    return parts.join(' ') || `M0,${this.scoreToY(50)} L100,${this.scoreToY(50)}`;
  }

  private buildRollingAveragePath(points: Array<number | null>): string {
    const n = points.length;
    if (n === 0) return '';
    const windowSize = 7;
    const avgPoints: Array<number | null> = [];
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const slice = points.slice(start, i + 1).filter((v): v is number => v !== null);
      avgPoints.push(slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : null);
    }
    const parts: string[] = [];
    let inSegment = false;
    for (let i = 0; i < n; i++) {
      const val = avgPoints[i];
      if (val === null) {
        inSegment = false;
        continue;
      }
      const x = n === 1 ? 50 : Number(((i / (n - 1)) * 100).toFixed(2));
      const y = Number(this.scoreToY(val).toFixed(2));
      if (!inSegment) {
        parts.push(`M${x},${y}`);
        inSegment = true;
      } else {
        parts.push(`L${x},${y}`);
      }
    }
    return parts.join(' ');
  }

  private buildDataDots(points: Array<number | null>): Array<{ x: number; y: number }> {
    const n = points.length;
    return points.reduce<Array<{ x: number; y: number }>>((acc, val, i) => {
      if (val !== null) {
        acc.push({
          x: n === 1 ? 50 : Number(((i / (n - 1)) * 100).toFixed(2)),
          y: this.scoreToY(val)
        });
      }
      return acc;
    }, []);
  }

  swingDiamondPoints(x: number, y: number): string {
    const s = 3.5;
    return `${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`;
  }

  private scoreToY(score: number): number {
    return Number((35 - (score / 100) * 24).toFixed(2));
  }

  private buildSwingMarkers(points: Array<number | null>): SwingMarker[] {
    const markers: SwingMarker[] = [];
    const n = points.length;
    if (n < 2) return markers;
    for (let i = 1; i < n; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (prev !== null && curr !== null && Math.abs(curr - prev) >= 40) {
        markers.push({ x: Number(((i - 1) / (n - 1) * 100).toFixed(2)), y: this.scoreToY(prev) });
        markers.push({ x: Number((i / (n - 1) * 100).toFixed(2)), y: this.scoreToY(curr) });
      }
    }
    return markers;
  }

  private firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? '';
  }

  private dayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    return Math.round((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }
}
