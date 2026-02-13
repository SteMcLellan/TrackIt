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

type RoutineRowSource = 'scheduled' | 'as-needed-base' | 'as-needed-log';

type RoutineMedicationRow = {
  id: string;
  medication: Medication;
  source: RoutineRowSource;
  status: 'taken' | 'not_taken';
  logId?: string;
  takenTimeLabel?: string;
};

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/0a32dfe56df640358837a966104aeb27
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
          } @else if (scheduledRows().length === 0 && asNeededBaseRows().length === 0) {
            <div class="routine-empty">No active medications scheduled today.</div>
          } @else {
            <div class="routine-groups">
              <section class="routine-group">
                <h3 class="routine-group-label">Scheduled</h3>
                @if (scheduledRows().length === 0) {
                  <p class="routine-sub-empty">No scheduled medications today.</p>
                } @else {
                  <div class="routine-list">
                    @for (row of scheduledRows(); track row.id) {
                      <article class="swipe-item" [class.reveal-actions]="isSwiping(row.id)">
                        <div class="swipe-rail rail-right" [class.disabled]="!canSwipeRight(row)">
                          <span class="material-symbols-outlined">check_circle</span>
                          <span>Taken</span>
                        </div>
                        <div class="swipe-rail rail-left" [class.disabled]="!canSwipeLeft(row)">
                          <span>Not Taken</span>
                          <span class="material-symbols-outlined">close</span>
                        </div>
                        <div
                          class="swipe-surface"
                          [class.dragging]="isSwiping(row.id)"
                          [style.transform]="swipeTransform(row.id)"
                          (pointerdown)="onSwipeStart($event, row)"
                          (pointermove)="onSwipeMove($event, row)"
                          (pointerup)="onSwipeEnd($event, row)"
                          (pointercancel)="onSwipeCancel(row.id)"
                          (lostpointercapture)="onSwipeCancel(row.id)"
                        >
                          <div class="medication-meta">
                            <div
                              class="medication-icon"
                              [class.taken]="row.status === 'taken'"
                              [class.not-taken]="row.status === 'not_taken'"
                            >
                              <span class="material-symbols-outlined">pill</span>
                            </div>
                            <div class="medication-copy">
                              <p class="medication-title">{{ row.medication.name }}</p>
                              <p class="medication-subtitle">
                                {{ row.medication.dosageText }} - {{ medicationFrequencyLabel(row.medication) }}
                              </p>
                            </div>
                          </div>

                          <div class="status-meta">
                            @if (isSaving(row.id)) {
                              <span class="status-saving">Saving...</span>
                            } @else if (row.status === 'taken') {
                              <div class="status-stack">
                                <span class="status-chip taken">
                                  <span class="material-symbols-outlined">check</span>
                                  <span>Taken</span>
                                </span>
                                @if (row.takenTimeLabel) {
                                  <span class="status-time">{{ row.takenTimeLabel }}</span>
                                }
                              </div>
                            } @else {
                              <span class="status-chip not-taken">
                                <span class="material-symbols-outlined">close</span>
                                <span>Not Taken</span>
                              </span>
                            }
                          </div>
                        </div>
                      </article>
                    }
                  </div>
                }
              </section>

              <section class="routine-group">
                <h3 class="routine-group-label">As Needed</h3>
                @if (asNeededBaseRows().length === 0) {
                  <p class="routine-sub-empty">No as-needed medications today.</p>
                } @else {
                  <div class="as-needed-list">
                    @for (baseRow of asNeededBaseRows(); track baseRow.id) {
                      <article class="as-needed-block">
                        <article class="swipe-item" [class.reveal-actions]="isSwiping(baseRow.id)">
                          <div class="swipe-rail rail-right" [class.disabled]="!canSwipeRight(baseRow)">
                            <span class="material-symbols-outlined">add_circle</span>
                            <span>Log Dose</span>
                          </div>
                          <div class="swipe-rail rail-left" [class.disabled]="!canSwipeLeft(baseRow)">
                            <span>Not Taken</span>
                            <span class="material-symbols-outlined">close</span>
                          </div>
                          <div
                            class="swipe-surface as-needed-base-surface"
                            [class.dragging]="isSwiping(baseRow.id)"
                            [style.transform]="swipeTransform(baseRow.id)"
                            (pointerdown)="onSwipeStart($event, baseRow)"
                            (pointermove)="onSwipeMove($event, baseRow)"
                            (pointerup)="onSwipeEnd($event, baseRow)"
                            (pointercancel)="onSwipeCancel(baseRow.id)"
                            (lostpointercapture)="onSwipeCancel(baseRow.id)"
                          >
                            <div class="medication-meta">
                              <div class="medication-icon not-taken">
                                <span class="material-symbols-outlined">pill</span>
                              </div>
                              <div class="medication-copy">
                                <p class="medication-title">{{ baseRow.medication.name }}</p>
                                <p class="medication-subtitle">
                                  {{ baseRow.medication.dosageText }} - {{ medicationFrequencyLabel(baseRow.medication) }}
                                </p>
                              </div>
                            </div>
                            <div class="as-needed-trailing">
                              @if (isSaving(baseRow.id)) {
                                <span class="status-saving">Saving...</span>
                              } @else {
                                <span class="material-symbols-outlined">chevron_right</span>
                              }
                            </div>
                          </div>
                        </article>

                        @if (asNeededVisibleEventRows(baseRow.medication.id).length > 0) {
                          <div class="as-needed-events">
                            @for (eventRow of asNeededVisibleEventRows(baseRow.medication.id); track eventRow.id) {
                              <article class="event-swipe-item" [class.reveal-actions]="isSwiping(eventRow.id)">
                                <div class="event-swipe-rail">
                                  <span class="material-symbols-outlined">delete</span>
                                  <span>Remove</span>
                                </div>
                                <div
                                  class="event-swipe-surface"
                                  [class.dragging]="isSwiping(eventRow.id)"
                                  [style.transform]="swipeTransform(eventRow.id)"
                                  (pointerdown)="onSwipeStart($event, eventRow)"
                                  (pointermove)="onSwipeMove($event, eventRow)"
                                  (pointerup)="onSwipeEnd($event, eventRow)"
                                  (pointercancel)="onSwipeCancel(eventRow.id)"
                                  (lostpointercapture)="onSwipeCancel(eventRow.id)"
                                >
                                  <span class="material-symbols-outlined">check_circle</span>
                                  <span>Taken - {{ eventRow.takenTimeLabel ?? 'Time n/a' }}</span>
                                </div>
                              </article>
                            }
                            @if (asNeededOverflowCount(baseRow.medication.id) > 0) {
                              <p class="as-needed-overflow">
                                +{{ asNeededOverflowCount(baseRow.medication.id) }} more
                              </p>
                            }
                          </div>
                        }
                      </article>
                    }
                  </div>
                }
              </section>
            </div>
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
      gap: 1.25rem;
    }

    .routine-groups {
      display: grid;
      gap: 1.1rem;
    }

    .routine-group {
      display: grid;
      gap: 0.7rem;
    }

    .routine-group + .routine-group {
      border-top: 1px solid #f8fafc;
      padding-top: 0.7rem;
    }

    .routine-group-label {
      margin: 0;
      color: #94a3b8;
      font-size: 0.56rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .routine-sub-empty {
      margin: 0;
      border-radius: 0.8rem;
      border: 1px dashed #d8e0ea;
      color: #64748b;
      background: #fff;
      font-size: 0.75rem;
      padding: 0.7rem 0.8rem;
    }

    .routine-list,
    .as-needed-list {
      display: grid;
      gap: 0;
    }

    .routine-list .swipe-item + .swipe-item {
      border-top: 1px solid #f8fafc;
      margin-top: 0.7rem;
      padding-top: 0.7rem;
    }

    .as-needed-block {
      display: grid;
      gap: 0.45rem;
    }

    .as-needed-block + .as-needed-block {
      border-top: 1px solid #f8fafc;
      margin-top: 0.7rem;
      padding-top: 0.7rem;
    }

    .as-needed-events {
      margin-left: 3.3rem;
      display: grid;
      gap: 0.35rem;
    }

    .as-needed-overflow {
      margin: 0;
      color: #94a3b8;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding-left: 0.2rem;
    }

    .swipe-item {
      position: relative;
      border-radius: 0.8rem;
      overflow: hidden;
      background: #fff;
    }

    .swipe-rail {
      position: absolute;
      inset: 0;
      z-index: 0;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0 1rem;
      border-radius: 0.8rem;
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      pointer-events: none;
      opacity: 0;
      transition: opacity 120ms ease;
    }

    .swipe-item.reveal-actions .swipe-rail {
      opacity: 1;
    }

    .swipe-rail .material-symbols-outlined {
      font-size: 1rem;
      line-height: 1;
    }

    .swipe-rail.rail-right {
      right: 50%;
      justify-content: flex-start;
      background: #10b981;
    }

    .swipe-rail.rail-left {
      left: 50%;
      justify-content: flex-end;
      background: #64748b;
    }

    .swipe-rail.disabled {
      opacity: 0.22;
    }

    .as-needed-base-surface {
      min-height: 72px;
    }

    .swipe-surface {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
      min-height: 76px;
      padding: 0.75rem 0 0.75rem 0;
      border-radius: 0.8rem;
      border: none;
      background: #fff;
      transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
      touch-action: pan-y;
      user-select: none;
    }

    .swipe-surface.dragging {
      transition: none;
    }

    .as-needed-trailing {
      min-width: 2rem;
      display: inline-flex;
      justify-content: flex-end;
      align-items: center;
      color: #c0cad8;
    }

    .as-needed-trailing .material-symbols-outlined {
      font-size: 1.25rem;
      line-height: 1;
    }

    .event-swipe-item {
      position: relative;
      border-radius: 0.5rem;
      overflow: hidden;
      background: #fff;
    }

    .event-swipe-rail {
      position: absolute;
      inset: 0;
      z-index: 0;
      border-radius: 0.5rem;
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
      padding: 0 0.65rem;
      color: #fff;
      background: #64748b;
      font-size: 0.54rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      pointer-events: none;
      opacity: 0;
      transition: opacity 120ms ease;
    }

    .event-swipe-item.reveal-actions .event-swipe-rail {
      opacity: 1;
    }

    .event-swipe-rail .material-symbols-outlined {
      font-size: 0.85rem;
      line-height: 1;
    }

    .event-swipe-surface {
      position: relative;
      z-index: 1;
      min-height: 30px;
      border-radius: 0.5rem;
      border: none;
      background: #fff;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      width: 100%;
      padding: 0.35rem 0.55rem;
      color: #64748b;
      font-size: 0.62rem;
      font-weight: 600;
      transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
      touch-action: pan-y;
      user-select: none;
    }

    .event-swipe-surface.dragging {
      transition: none;
    }

    .event-swipe-surface .material-symbols-outlined {
      font-size: 0.85rem;
      line-height: 1;
      color: #10b981;
      flex-shrink: 0;
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
      border: 1px solid transparent;
      flex-shrink: 0;
    }

    .medication-icon .material-symbols-outlined {
      font-size: 1.2rem;
      line-height: 1;
    }

    .medication-icon.taken {
      color: #10b981;
      background: #ecfdf5;
      border-color: rgba(16, 185, 129, 0.24);
    }

    .medication-icon.not-taken {
      color: #64748b;
      background: #f1f5f9;
      border-color: rgba(100, 116, 139, 0.25);
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

    .status-meta {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      flex-shrink: 0;
      min-width: 5.6rem;
    }

    .status-stack {
      display: grid;
      justify-items: end;
      gap: 0.2rem;
    }

    .status-saving {
      color: #64748b;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .status-chip {
      min-height: 30px;
      border-radius: 999px;
      border: 1px solid transparent;
      padding: 0.22rem 0.56rem;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.66rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }

    .status-chip .material-symbols-outlined {
      font-size: 0.88rem;
      line-height: 1;
    }

    .status-chip.taken {
      color: #10b981;
      background: #ecfdf5;
      border-color: rgba(16, 185, 129, 0.3);
    }

    .status-chip.not-taken {
      color: #64748b;
      background: #f1f5f9;
      border-color: rgba(100, 116, 139, 0.25);
    }

    .status-time {
      color: #94a3b8;
      font-size: 0.58rem;
      font-weight: 700;
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      white-space: nowrap;
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
  readonly swipeOffsetMap = signal<Record<string, number>>({});
  readonly swipeActiveMap = signal<Record<string, boolean>>({});
  readonly routineError = signal<string | null>(null);
  private readonly refreshTick = signal(0);
  private readonly swipeStartX = new Map<string, number>();
  private readonly swipeStartY = new Map<string, number>();
  private readonly swipePointerId = new Map<string, number>();
  private readonly swipeAxisLock = new Map<string, 'x' | 'y' | null>();
  private readonly SWIPE_MAX_PX = 112;
  private readonly SWIPE_TRIGGER_PX = 64;
  private readonly SWIPE_LOCK_PX = 8;
  private readonly AS_NEEDED_EVENT_PREVIEW_LIMIT = 3;

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
      .filter((item) => !item.endDateUtc || item.endDateUtc >= today);
  });

  readonly todayLogs = computed(() =>
    this.logs().filter((log) => log.logLocalDate === this.todayLocalDate())
  );

  readonly routineRows = computed<RoutineMedicationRow[]>(() => {
    const rows: RoutineMedicationRow[] = [];
    const logsByMedication = new Map<string, MedicationLog[]>();

    for (const log of this.todayLogs()) {
      const existing = logsByMedication.get(log.medicationId) ?? [];
      existing.push(log);
      logsByMedication.set(log.medicationId, existing);
    }

    for (const medication of this.routineMedications()) {
      const medicationLogs = [...(logsByMedication.get(medication.id) ?? [])].sort(
        (a, b) => this.logSortTimeMs(b) - this.logSortTimeMs(a)
      );

      if (this.isAsNeededMedication(medication)) {
        rows.push({
          id: `routine_${medication.id}_base`,
          medication,
          source: 'as-needed-base',
          status: 'not_taken'
        });

        for (const log of medicationLogs) {
          if (log.status !== 'taken') {
            continue;
          }
          rows.push({
            id: `routine_${log.id}`,
            medication,
            source: 'as-needed-log',
            status: 'taken',
            logId: log.id,
            takenTimeLabel: this.formatTakenTime(log)
          });
        }
        continue;
      }

      const latest = medicationLogs[0];
      const status: 'taken' | 'not_taken' = latest?.status === 'taken' ? 'taken' : 'not_taken';
      rows.push({
        id: `routine_${medication.id}_scheduled`,
        medication,
        source: 'scheduled',
        status,
        logId: latest?.id,
        takenTimeLabel: status === 'taken' && latest ? this.formatTakenTime(latest) : undefined
      });
    }

    return rows;
  });

  readonly scheduledRows = computed(() =>
    this.routineRows().filter((row) => row.source === 'scheduled')
  );

  readonly asNeededBaseRows = computed(() =>
    this.routineRows().filter((row) => row.source === 'as-needed-base')
  );

  readonly asNeededEventRowsByMedicationId = computed(() => {
    const eventMap = new Map<string, RoutineMedicationRow[]>();
    for (const row of this.routineRows()) {
      if (row.source !== 'as-needed-log') {
        continue;
      }
      const existing = eventMap.get(row.medication.id) ?? [];
      existing.push(row);
      eventMap.set(row.medication.id, existing);
    }
    return eventMap;
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

  isSaving(rowId: string): boolean {
    return !!this.savingMap()[rowId];
  }

  isSwiping(rowId: string): boolean {
    return !!this.swipeActiveMap()[rowId];
  }

  swipeTransform(rowId: string): string {
    const offset = this.swipeOffsetMap()[rowId] ?? 0;
    return offset === 0 ? 'none' : `translate3d(${offset}px, 0, 0)`;
  }

  canSwipeLeft(row: RoutineMedicationRow): boolean {
    return row.source !== 'as-needed-base';
  }

  canSwipeRight(row: RoutineMedicationRow): boolean {
    return row.source !== 'as-needed-log';
  }

  asNeededVisibleEventRows(medicationId: string): RoutineMedicationRow[] {
    return (this.asNeededEventRowsByMedicationId().get(medicationId) ?? []).slice(
      0,
      this.AS_NEEDED_EVENT_PREVIEW_LIMIT
    );
  }

  asNeededOverflowCount(medicationId: string): number {
    const total = this.asNeededEventRowsByMedicationId().get(medicationId)?.length ?? 0;
    return Math.max(0, total - this.AS_NEEDED_EVENT_PREVIEW_LIMIT);
  }

  onSwipeStart(event: PointerEvent, row: RoutineMedicationRow): void {
    if (event.button !== 0 || this.isSaving(row.id)) {
      return;
    }

    const surface = event.currentTarget as HTMLElement | null;
    surface?.setPointerCapture(event.pointerId);

    this.swipePointerId.set(row.id, event.pointerId);
    this.swipeStartX.set(row.id, event.clientX);
    this.swipeStartY.set(row.id, event.clientY);
    this.swipeAxisLock.set(row.id, null);
    this.swipeActiveMap.update((state) => ({ ...state, [row.id]: true }));
  }

  onSwipeMove(event: PointerEvent, row: RoutineMedicationRow): void {
    if (this.swipePointerId.get(row.id) !== event.pointerId) {
      return;
    }

    const startX = this.swipeStartX.get(row.id);
    const startY = this.swipeStartY.get(row.id);
    if (typeof startX !== 'number' || typeof startY !== 'number') {
      return;
    }

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    const currentAxis = this.swipeAxisLock.get(row.id);

    if (!currentAxis) {
      if (Math.abs(deltaX) < this.SWIPE_LOCK_PX && Math.abs(deltaY) < this.SWIPE_LOCK_PX) {
        return;
      }
      this.swipeAxisLock.set(row.id, Math.abs(deltaX) >= Math.abs(deltaY) ? 'x' : 'y');
    }

    if (this.swipeAxisLock.get(row.id) === 'y') {
      return;
    }

    event.preventDefault();
    let clamped = Math.max(-this.SWIPE_MAX_PX, Math.min(this.SWIPE_MAX_PX, deltaX));
    if (!this.canSwipeLeft(row) && clamped < 0) {
      clamped = 0;
    }
    if (!this.canSwipeRight(row) && clamped > 0) {
      clamped = 0;
    }
    this.setSwipeOffset(row.id, clamped);
  }

  onSwipeEnd(event: PointerEvent, row: RoutineMedicationRow): void {
    if (this.swipePointerId.get(row.id) !== event.pointerId) {
      return;
    }

    const surface = event.currentTarget as HTMLElement | null;
    if (surface?.hasPointerCapture(event.pointerId)) {
      surface.releasePointerCapture(event.pointerId);
    }

    const offset = this.swipeOffsetMap()[row.id] ?? 0;
    this.onSwipeCancel(row.id);

    if (offset >= this.SWIPE_TRIGGER_PX && this.canSwipeRight(row)) {
      this.handleSwipeRight(row);
      return;
    }

    if (offset <= -this.SWIPE_TRIGGER_PX && this.canSwipeLeft(row)) {
      this.handleSwipeLeft(row);
    }
  }

  onSwipeCancel(rowId: string): void {
    this.setSwipeOffset(rowId, 0);
    this.swipeActiveMap.update((state) => this.removeKey(state, rowId));
    this.swipeStartX.delete(rowId);
    this.swipeStartY.delete(rowId);
    this.swipePointerId.delete(rowId);
    this.swipeAxisLock.delete(rowId);
  }

  private handleSwipeRight(row: RoutineMedicationRow): void {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return;
    }

    const frequency = this.resolveMedicationFrequency(row.medication);
    if (!frequency) {
      this.routineError.set('Medication frequency is missing. Update this medication in Profile.');
      return;
    }

    if (row.source === 'as-needed-log') {
      return;
    }

    this.routineError.set(null);
    this.setSaving(row.id, true);
    const logLocalDate = this.todayLocalDate();
    const logTzOffsetMinutes = -new Date().getTimezoneOffset();

    if (frequency === 'as-needed') {
      this.medicationLogs
        .createAsNeededLog(participantId, row.medication.id, logLocalDate, { logTzOffsetMinutes })
        .subscribe({
          next: () => {
            this.setSaving(row.id, false);
            this.refreshTick.update((value) => value + 1);
          },
          error: () => {
            this.setSaving(row.id, false);
            this.routineError.set('Unable to update routine status. Please try again.');
          }
        });
      return;
    }

    this.medicationLogs
      .upsertLog(participantId, row.medication.id, logLocalDate, {
        status: 'taken',
        logTzOffsetMinutes,
        occurrenceKey: this.defaultOccurrenceKey(frequency)
      })
      .subscribe({
        next: () => {
          this.setSaving(row.id, false);
          this.refreshTick.update((value) => value + 1);
        },
        error: () => {
          this.setSaving(row.id, false);
          this.routineError.set('Unable to update routine status. Please try again.');
        }
      });
  }

  private handleSwipeLeft(row: RoutineMedicationRow): void {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return;
    }

    if (row.source === 'as-needed-base') {
      return;
    }

    this.routineError.set(null);

    if (row.source === 'as-needed-log') {
      if (!row.logId) {
        this.routineError.set('Missing log id for this as-needed entry.');
        return;
      }
      this.setSaving(row.id, true);
      this.medicationLogs.deleteLog(participantId, row.logId).subscribe({
        next: () => {
          this.setSaving(row.id, false);
          this.refreshTick.update((value) => value + 1);
        },
        error: () => {
          this.setSaving(row.id, false);
          this.routineError.set('Unable to remove this medication log. Please try again.');
        }
      });
      return;
    }

    const frequency = this.resolveMedicationFrequency(row.medication);
    if (!frequency || frequency === 'as-needed') {
      this.routineError.set('Unable to update routine status. Please try again.');
      return;
    }

    this.setSaving(row.id, true);
    this.medicationLogs
      .upsertLog(participantId, row.medication.id, this.todayLocalDate(), {
        status: 'not_taken',
        logTzOffsetMinutes: -new Date().getTimezoneOffset(),
        occurrenceKey: this.defaultOccurrenceKey(frequency)
      })
      .subscribe({
        next: () => {
          this.setSaving(row.id, false);
          this.refreshTick.update((value) => value + 1);
        },
        error: () => {
          this.setSaving(row.id, false);
          this.routineError.set('Unable to update routine status. Please try again.');
        }
      });
  }

  medicationFrequencyLabel(medication: Medication): string {
    const frequency = this.resolveMedicationFrequency(medication);
    if (frequency === 'once-daily') return 'Once daily';
    if (frequency === 'twice-daily') return 'Twice daily';
    if (frequency === 'three-times-daily') return 'Three times daily';
    if (frequency === 'as-needed') return 'As needed';
    return 'Frequency not set';
  }

  isAsNeededMedication(medication: Medication): boolean {
    return this.resolveMedicationFrequency(medication) === 'as-needed';
  }

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

  private setSaving(medicationId: string, value: boolean): void {
    this.savingMap.update((state) => ({ ...state, [medicationId]: value }));
  }

  private setSwipeOffset(medicationId: string, value: number): void {
    this.swipeOffsetMap.update((state) => ({ ...state, [medicationId]: value }));
  }

  private removeKey<T>(source: Record<string, T>, key: string): Record<string, T> {
    const next = { ...source };
    delete next[key];
    return next;
  }

  private logSortTimeMs(log: MedicationLog): number {
    const updated = Date.parse(log.updatedAtUtc);
    if (Number.isFinite(updated)) {
      return updated;
    }
    const created = Date.parse(log.createdAtUtc);
    return Number.isFinite(created) ? created : 0;
  }

  private formatTakenTime(log: MedicationLog): string | undefined {
    const utcMillis = this.logSortTimeMs(log);
    if (!Number.isFinite(utcMillis) || utcMillis <= 0) {
      return undefined;
    }

    const localMillis = utcMillis + log.logTzOffsetMinutes * 60_000;
    const localInstant = new Date(localMillis);
    const hh = String(localInstant.getUTCHours()).padStart(2, '0');
    const mm = String(localInstant.getUTCMinutes()).padStart(2, '0');
    return this.formatTimeLabel(`${hh}:${mm}`);
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

  private defaultOccurrenceKey(frequency: Exclude<MedicationFrequency, 'as-needed'>): string {
    if (frequency === 'three-times-daily') return 'dose-1';
    if (frequency === 'twice-daily') return 'dose-1';
    return 'dose-1';
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
