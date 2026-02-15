import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CollectionResponse } from '../../shared/models/collection';
import { MedicationLog } from '../../shared/models/medication-log';
import { Medication } from '../../shared/models/medication';
import { MedicationLogService } from '../../shared/services/medication-log.service';
import { ParticipantService } from '../../shared/services/participant.service';
import { computeTzOffsetMinutes } from '../../shared/utils/datetime';
import { environment } from '../../../environments/environment';

type MedicationsResponse = CollectionResponse<Medication>;
type MedicationLogsResponse = CollectionResponse<MedicationLog>;

type MedicationFrequency =
  | 'once-daily'
  | 'twice-daily'
  | 'three-times-daily'
  | 'as-needed';

type MedicationWithFrequency = Medication & {
  frequency?: MedicationFrequency;
  frequencyText?: string;
};

type RoutineRowSource = 'scheduled' | 'as-needed-base' | 'as-needed-log';

type RoutineMedicationRow = {
  id: string;
  medication: Medication;
  source: RoutineRowSource;
  status: 'taken' | 'not_taken';
  logId?: string;
  logLocalDate?: string;
  logLocalTime?: string;
  logTzOffsetMinutes?: number;
  takenAtUtc?: string;
  occurrenceKey?: string;
  takenTimeLabel?: string;
};

type ScheduledMedicationCard = {
  medication: Medication;
  frequency: MedicationFrequency;
  expectedDoses: number;
  takenDoses: number;
  rows: RoutineMedicationRow[];
  cardStatus: 'complete' | 'partial' | 'not-taken';
  nextDoseLabel: string | null;
};

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/1c407bc5614340b7bd19044f71ece31c
 * @stitch-screen-title Medication Command Center
 * @stitch-status implementing
 * @stitch-last-sync 2026-02-15
 */
@Component({
  selector: 'app-medications-dashboard',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <!-- Summary card -->
      <section class="summary-card">
        <div class="summary-ring-group">
          <div class="summary-ring">
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
          <div class="summary-copy">
            <p class="summary-title">Today's Medications</p>
            @if (medicationSummary().totalExpectedDoses === 0) {
              <p class="summary-fraction">No scheduled doses today</p>
            } @else {
              <p class="summary-fraction">
                {{ medicationSummary().takenDoses }} of {{ medicationSummary().totalExpectedDoses }} doses taken
              </p>
            }
          </div>
        </div>
        <div class="summary-trailing">
          @if (adherenceStatus() === 'complete') {
            <span class="summary-chip complete">All on track</span>
          } @else if (adherenceStatus() === 'pending') {
            <span class="summary-chip pending">
              {{ medicationSummary().totalExpectedDoses - medicationSummary().takenDoses }} remaining
            </span>
          } @else {
            <span class="summary-chip none">None scheduled</span>
          }
        </div>
      </section>

      <!-- Scheduled medications -->
      <section class="section">
        <h2 class="section-label">Scheduled</h2>
        @if (routineError()) {
          <p class="error">{{ routineError() }}</p>
        }
        @if (!routineLoadedOnce() && (medicationsResource.isLoading() || logsResource.isLoading())) {
          <div class="empty-state">Loading medications...</div>
        } @else if (scheduledCards().length === 0) {
          <div class="empty-state">No scheduled medications today.</div>
        } @else {
          <div class="card-list">
            @for (card of scheduledCards(); track card.medication.id) {
              <article class="med-card">
                <div class="med-card-header">
                  <div
                    class="med-icon"
                    [class.taken]="card.cardStatus === 'complete'"
                    [class.partial]="card.cardStatus === 'partial'"
                    [class.not-taken]="card.cardStatus === 'not-taken'"
                  >
                    @if (card.cardStatus === 'complete') {
                      <span class="material-symbols-outlined">check_circle</span>
                    } @else {
                      <span class="material-symbols-outlined">pill</span>
                    }
                  </div>
                  <div class="med-copy">
                    <p class="med-title">{{ card.medication.name }}</p>
                    <p class="med-subtitle">{{ card.medication.dosageText }} · {{ frequencyLabel(card.frequency) }}</p>
                  </div>
                  <div class="status-meta">
                    @if (card.cardStatus === 'complete') {
                      <span class="status-chip taken">Taken</span>
                    } @else if (card.cardStatus === 'partial') {
                      <div class="status-stack">
                        <span class="status-chip pending">Pending</span>
                        <span class="status-fraction">{{ card.takenDoses }} of {{ card.expectedDoses }}</span>
                      </div>
                    } @else {
                      <span class="status-chip not-taken">Not Taken</span>
                    }
                  </div>
                </div>
                @for (row of card.rows; track row.id) {
                  <div
                    class="swipe-item dose-swipe-item"
                    [class.reveal-actions]="isSwiping(row.id)"
                    [class.reveal-right]="isSwipingRight(row.id)"
                    [class.reveal-left]="isSwipingLeft(row.id)"
                  >
                    <div class="swipe-rail rail-right">
                      <span class="material-symbols-outlined">check_circle</span>
                      <span>Taken</span>
                    </div>
                    <div class="swipe-rail rail-left">
                      <span>Not Taken</span>
                      <span class="material-symbols-outlined">close</span>
                    </div>
                    <div
                      class="swipe-surface dose-surface"
                      [class.dragging]="isSwiping(row.id)"
                      [style.transform]="swipeTransform(row.id)"
                      (pointerdown)="onSwipeStart($event, row)"
                      (pointermove)="onSwipeMove($event, row)"
                      (pointerup)="onSwipeEnd($event, row)"
                      (pointercancel)="onSwipeCancel(row.id)"
                      (lostpointercapture)="onSwipeCancel(row.id)"
                    >
                      <div class="dose-row-meta">
                        @if (row.status === 'taken') {
                          <span class="material-symbols-outlined taken-check">check_circle</span>
                          <span class="taken-time-copy">
                            {{ doseSlotLabel(row, card) }} — {{ row.takenTimeLabel ?? 'Time n/a' }}
                          </span>
                          <button
                            class="time-edit-button"
                            type="button"
                            [disabled]="isSaving(row.id)"
                            (pointerdown)="$event.stopPropagation()"
                            (click)="openTimeEditor(row, $event)"
                          >
                            <span class="material-symbols-outlined">edit</span>
                          </button>
                        } @else {
                          <span class="material-symbols-outlined dose-pending-icon">radio_button_unchecked</span>
                          <span class="dose-pending-copy">{{ doseSlotLabel(row, card) }}</span>
                        }
                      </div>
                      @if (isSaving(row.id)) {
                        <span class="status-saving">Saving...</span>
                      }
                    </div>
                  </div>
                }
              </article>
            }
          </div>
        }
      </section>

      <!-- As-needed medications -->
      <section class="section">
        <h2 class="section-label">As Needed</h2>
        @if (asNeededBaseRows().length === 0) {
          <div class="empty-state">No as-needed medications today.</div>
        } @else {
          <div class="card-list">
            @for (baseRow of asNeededBaseRows(); track baseRow.id) {
              <article class="med-card">
                <div class="med-card-header">
                  <div class="med-icon not-taken">
                    <span class="material-symbols-outlined">pill</span>
                  </div>
                  <div class="med-copy">
                    <p class="med-title">{{ baseRow.medication.name }}</p>
                    <p class="med-subtitle">{{ baseRow.medication.dosageText }}</p>
                  </div>
                  <span class="material-symbols-outlined med-chevron">chevron_right</span>
                </div>
                @for (eventRow of asNeededVisibleEventRows(baseRow.medication.id); track eventRow.id) {
                  <div
                    class="swipe-item dose-swipe-item"
                    [class.reveal-actions]="isSwiping(eventRow.id)"
                    [class.reveal-left]="isSwipingLeft(eventRow.id)"
                  >
                    <div class="swipe-rail rail-left">
                      <span>Remove</span>
                      <span class="material-symbols-outlined">delete</span>
                    </div>
                    <div
                      class="swipe-surface dose-surface"
                      [class.dragging]="isSwiping(eventRow.id)"
                      [style.transform]="swipeTransform(eventRow.id)"
                      (pointerdown)="onSwipeStart($event, eventRow)"
                      (pointermove)="onSwipeMove($event, eventRow)"
                      (pointerup)="onSwipeEnd($event, eventRow)"
                      (pointercancel)="onSwipeCancel(eventRow.id)"
                      (lostpointercapture)="onSwipeCancel(eventRow.id)"
                    >
                      <div class="dose-row-meta">
                        <span class="material-symbols-outlined taken-check">check_circle</span>
                        <span class="taken-time-copy">
                          Taken — {{ eventRow.takenTimeLabel ?? 'Time n/a' }}
                        </span>
                        <button
                          class="time-edit-button"
                          type="button"
                          [disabled]="isSaving(eventRow.id)"
                          (pointerdown)="$event.stopPropagation()"
                          (click)="openTimeEditor(eventRow, $event)"
                        >
                          <span class="material-symbols-outlined">edit</span>
                        </button>
                      </div>
                      @if (isSaving(eventRow.id)) {
                        <span class="status-saving">Saving...</span>
                      }
                    </div>
                  </div>
                }
                @if (asNeededOverflowCount(baseRow.medication.id) > 0) {
                  <p class="as-needed-overflow">
                    +{{ asNeededOverflowCount(baseRow.medication.id) }} more
                  </p>
                }
                <div
                  class="swipe-item dose-swipe-item"
                  [class.reveal-actions]="isSwiping(baseRow.id)"
                  [class.reveal-right]="isSwipingRight(baseRow.id)"
                >
                  <div class="swipe-rail rail-right">
                    <span class="material-symbols-outlined">add_circle</span>
                    <span>Log Dose</span>
                  </div>
                  <div
                    class="swipe-surface dose-surface"
                    [class.dragging]="isSwiping(baseRow.id)"
                    [style.transform]="swipeTransform(baseRow.id)"
                    (pointerdown)="onSwipeStart($event, baseRow)"
                    (pointermove)="onSwipeMove($event, baseRow)"
                    (pointerup)="onSwipeEnd($event, baseRow)"
                    (pointercancel)="onSwipeCancel(baseRow.id)"
                    (lostpointercapture)="onSwipeCancel(baseRow.id)"
                  >
                    <div class="dose-row-meta">
                      <span class="material-symbols-outlined dose-pending-icon">add_circle_outline</span>
                      <span class="dose-pending-copy">Swipe to log a dose</span>
                    </div>
                    @if (isSaving(baseRow.id)) {
                      <span class="status-saving">Saving...</span>
                    }
                  </div>
                </div>
              </article>
            }
          </div>
        }
      </section>
    </div>
    <input
      #timePickerInput
      class="hidden-time-picker"
      type="time"
      [value]="timePickerValue()"
      (change)="onTimePickerChange($event)"
      (blur)="onTimePickerBlur()"
      tabindex="-1"
      aria-hidden="true"
    />
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
      padding: 1rem 1.5rem 12rem;
      box-sizing: border-box;
      overflow-x: hidden;
      background: var(--color-ghost-white-canvas, #fcfcfd);
    }

    /* Summary card */

    .summary-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 1rem 1.1rem;
      border-radius: 0.5rem;
      background: #fff;
      border: 1px solid #f1f5f9;
      box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.05);
    }

    .summary-ring-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
      flex: 1;
    }

    .summary-ring {
      position: relative;
      width: 56px;
      height: 56px;
      flex-shrink: 0;
    }

    .summary-ring svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .summary-ring circle {
      fill: none;
      stroke-width: 3;
      stroke-linecap: round;
    }

    .ring-bg { stroke: #e2e8f0; }
    .ring-amber { stroke: #f59e0b; }
    .ring-emerald { stroke: #10b981; }

    .ring-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 1.25rem;
      color: #64748b;
      line-height: 1;
    }

    .summary-copy {
      min-width: 0;
      display: grid;
      gap: 0.15rem;
    }

    .summary-title {
      margin: 0;
      color: #1e293b;
      font-size: 0.9375rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .summary-fraction {
      margin: 0;
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 500;
      line-height: 1.3;
    }

    .summary-trailing {
      flex-shrink: 0;
    }

    .summary-chip {
      border-radius: 999px;
      border: 1px solid transparent;
      padding: 0.25rem 0.5rem;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }

    .summary-chip.complete {
      color: #10b981;
      background: #ecfdf5;
      border-color: rgba(16, 185, 129, 0.3);
    }

    .summary-chip.pending {
      color: #f59e0b;
      background: #fffbeb;
      border-color: rgba(245, 158, 11, 0.3);
    }

    .summary-chip.none {
      color: #94a3b8;
      background: #f8fafc;
      border-color: #e2e8f0;
    }

    /* Sections */

    .section {
      padding-top: 1.5rem;
    }

    .section-label {
      margin: 0 0 0.75rem;
      color: #94a3b8;
      font-size: 0.5625rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .card-list {
      display: grid;
      gap: 0.75rem;
    }

    .empty-state {
      border-radius: 0.5rem;
      border: 1px dashed #cbd5e1;
      padding: 0.85rem 1rem;
      color: #64748b;
      font-size: 0.8125rem;
      background: #fff;
    }

    .error {
      margin: 0 0 0.5rem;
      color: #b91c1c;
      font-size: 0.8125rem;
      font-weight: 600;
    }

    /* Medication cards */

    .med-card {
      border-radius: 0.5rem;
      background: #fff;
      border: 1px solid #f1f5f9;
      box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }

    .med-card-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #f1f5f9;
    }

    .med-card-header .med-copy {
      flex: 1;
    }

    .swipe-item {
      position: relative;
      overflow: hidden;
    }

    .swipe-rail {
      position: absolute;
      inset: 0;
      z-index: 0;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0 1rem;
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      pointer-events: none;
      opacity: 0;
      transition: opacity 120ms ease;
    }

    .swipe-rail .material-symbols-outlined {
      font-size: 1rem;
      line-height: 1;
    }

    .swipe-rail.rail-right {
      left: 0;
      right: 50%;
      justify-content: flex-start;
      background: #10b981;
    }

    .swipe-rail.rail-left {
      left: 50%;
      right: 0;
      justify-content: flex-end;
      background: #64748b;
    }

    .swipe-item.reveal-right .swipe-rail.rail-right,
    .swipe-item.reveal-left .swipe-rail.rail-left {
      opacity: 1;
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
      padding: 0.75rem 1rem;
      background: #fff;
      transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
      touch-action: pan-y;
      user-select: none;
    }

    .swipe-surface.dragging {
      transition: none;
    }

    .med-meta {
      min-width: 0;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      flex: 1;
    }

    .med-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid transparent;
      flex-shrink: 0;
    }

    .med-icon .material-symbols-outlined {
      font-size: 1.2rem;
      line-height: 1;
    }

    .med-icon.taken {
      color: #10b981;
      background: #ecfdf5;
      border-color: rgba(16, 185, 129, 0.24);
    }

    .med-icon.partial {
      color: #f59e0b;
      background: #fffbeb;
      border-color: rgba(245, 158, 11, 0.24);
    }

    .med-icon.not-taken {
      color: #64748b;
      background: #f1f5f9;
      border-color: rgba(100, 116, 139, 0.25);
    }

    .med-copy {
      min-width: 0;
      display: grid;
      gap: 0.15rem;
    }

    .med-title {
      margin: 0;
      color: #1e293b;
      font-size: 0.875rem;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    .med-subtitle {
      margin: 0;
      color: #94a3b8;
      font-size: 0.6875rem;
      font-weight: 500;
    }

    .taken-time-row {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      min-height: 1.25rem;
      margin-top: 0.15rem;
    }

    .taken-check {
      font-size: 0.85rem;
      line-height: 1;
      color: #10b981;
      flex-shrink: 0;
    }

    .taken-time-copy {
      color: #64748b;
      font-size: 0.6875rem;
      font-weight: 500;
      white-space: nowrap;
    }

    .dose-surface {
      min-height: 44px;
      padding: 0.5rem 1rem;
    }

    .dose-row-meta {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      flex: 1;
      min-width: 0;
    }

    .dose-pending-icon {
      font-size: 0.85rem;
      line-height: 1;
      color: #cbd5e1;
      flex-shrink: 0;
    }

    .dose-pending-copy {
      color: #94a3b8;
      font-size: 0.6875rem;
      font-weight: 500;
    }

    .dose-swipe-item + .dose-swipe-item {
      border-top: 1px solid #f1f5f9;
    }

    .next-dose-hint {
      margin: 0.1rem 0 0;
      color: #f59e0b;
      font-size: 0.625rem;
      font-weight: 500;
    }

    .time-edit-button {
      border: none;
      background: transparent;
      padding: 0;
      margin: 0;
      cursor: pointer;
      color: #10b981;
      display: inline-flex;
      align-items: center;
    }

    .time-edit-button .material-symbols-outlined {
      font-size: 0.875rem;
      line-height: 1;
    }

    .time-edit-button:disabled {
      cursor: default;
      opacity: 0.5;
    }

    .hidden-time-picker {
      position: fixed;
      left: -9999px;
      top: 0;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }

    .status-meta {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      flex-shrink: 0;
    }

    .status-stack {
      display: grid;
      justify-items: center;
      gap: 0.15rem;
    }

    .status-saving {
      color: #64748b;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .status-chip {
      border-radius: 999px;
      border: 1px solid transparent;
      padding: 0.2rem 0.5rem;
      display: inline-flex;
      align-items: center;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }

    .status-chip.taken {
      color: #10b981;
      background: #ecfdf5;
      border-color: rgba(16, 185, 129, 0.3);
    }

    .status-chip.pending {
      color: #f59e0b;
      background: #fffbeb;
      border-color: rgba(245, 158, 11, 0.3);
    }

    .status-chip.not-taken {
      color: #64748b;
      background: #f1f5f9;
      border-color: rgba(100, 116, 139, 0.25);
    }

    .status-fraction {
      color: #94a3b8;
      font-size: 0.5625rem;
      font-weight: 700;
    }

    .med-chevron {
      color: #cbd5e1;
      font-size: 1.25rem;
      line-height: 1;
      flex-shrink: 0;
    }

    .as-needed-overflow {
      margin: 0;
      color: #94a3b8;
      font-size: 0.5625rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.3rem 1rem;
    }
  `]
})
export class MedicationsDashboardComponent {
  private readonly participantService = inject(ParticipantService);
  private readonly medicationLogs = inject(MedicationLogService);
  @ViewChild('timePickerInput') private readonly timePickerInput?: ElementRef<HTMLInputElement>;

  readonly activeParticipantId = this.participantService.activeParticipantId;
  readonly todayLocalDate = signal(this.formatLocalDate(new Date()));

  readonly savingMap = signal<Record<string, boolean>>({});
  readonly timePickerRowId = signal<string | null>(null);
  readonly timePickerInitialValue = signal('');
  readonly timePickerValue = signal('');
  readonly swipeOffsetMap = signal<Record<string, number>>({});
  readonly swipeActiveMap = signal<Record<string, boolean>>({});
  readonly routineError = signal<string | null>(null);
  readonly routineLoadedOnce = signal(false);
  private readonly cachedMedications = signal<Medication[]>([]);
  private readonly cachedLogs = signal<MedicationLog[]>([]);
  private readonly refreshTick = signal(0);
  private readonly swipeStartX = new Map<string, number>();
  private readonly swipeStartY = new Map<string, number>();
  private readonly swipePointerId = new Map<string, number>();
  private readonly swipeAxisLock = new Map<string, 'x' | 'y' | null>();
  private readonly SWIPE_MAX_PX = 112;
  private readonly SWIPE_TRIGGER_PX = 64;
  private readonly SWIPE_LOCK_PX = 8;
  private readonly AS_NEEDED_EVENT_PREVIEW_LIMIT = 3;
  private readonly DOSE_SLOT_LABELS: Record<string, string> = {
    'dose-1': 'Morning',
    'dose-2': 'Afternoon',
    'dose-3': 'Evening'
  };

  readonly medicationsResource = httpResource<MedicationsResponse>(() => {
    const participantId = this.activeParticipantId();
    if (!participantId) {
      return { url: `${environment.apiBaseUrl}/participants/unknown/medications`, method: 'GET', params: { pageSize: '1' } };
    }
    return { url: `${environment.apiBaseUrl}/participants/${participantId}/medications`, method: 'GET', params: { pageSize: '200' } };
  });

  readonly logsResource = httpResource<MedicationLogsResponse>(() => {
    const participantId = this.activeParticipantId();
    const startDate = this.todayLocalDate();
    const endDate = this.todayLocalDate();
    this.refreshTick();
    if (!participantId) {
      return { url: `${environment.apiBaseUrl}/participants/unknown/medication-logs`, method: 'GET', params: { startDate, endDate, pageSize: '1' } };
    }
    return { url: `${environment.apiBaseUrl}/participants/${participantId}/medication-logs`, method: 'GET', params: { startDate, endDate, pageSize: '300' } };
  });

  readonly medications = computed(() =>
    this.medicationsResource.hasValue() ? this.medicationsResource.value().items : this.cachedMedications()
  );

  readonly logs = computed(() =>
    this.logsResource.hasValue() ? this.logsResource.value().items : this.cachedLogs()
  );

  readonly routineMedications = computed(() => {
    const today = this.todayLocalDate();
    return this.medications()
      .filter(item => !item.archivedAtUtc)
      .filter(item => item.startDateUtc <= today)
      .filter(item => !item.endDateUtc || item.endDateUtc >= today);
  });

  readonly todayLogs = computed(() =>
    this.logs().filter(log => log.logLocalDate === this.todayLocalDate())
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
        rows.push({ id: `routine_${medication.id}_base`, medication, source: 'as-needed-base', status: 'not_taken' });
        for (const log of medicationLogs) {
          if (log.status !== 'taken') continue;
          rows.push({
            id: `routine_${log.id}`, medication, source: 'as-needed-log', status: 'taken',
            logId: log.id, logLocalDate: log.logLocalDate, logLocalTime: log.logLocalTime,
            logTzOffsetMinutes: log.logTzOffsetMinutes, takenAtUtc: log.takenAtUtc,
            occurrenceKey: log.occurrenceKey, takenTimeLabel: this.formatTakenTime(log)
          });
        }
        continue;
      }

      const frequency = this.resolveMedicationFrequency(medication);
      const slotCount = frequency ? this.frequencySlotCount(frequency) : 1;

      for (let slot = 1; slot <= slotCount; slot++) {
        const occurrenceKey = `dose-${slot}`;
        const slotLog = medicationLogs.find(l => l.occurrenceKey === occurrenceKey);
        const status: 'taken' | 'not_taken' = slotLog?.status === 'taken' ? 'taken' : 'not_taken';
        rows.push({
          id: `routine_${medication.id}_${occurrenceKey}`,
          medication, source: 'scheduled', status,
          logId: slotLog?.id, logLocalDate: slotLog?.logLocalDate, logLocalTime: slotLog?.logLocalTime,
          logTzOffsetMinutes: slotLog?.logTzOffsetMinutes, takenAtUtc: slotLog?.takenAtUtc,
          occurrenceKey,
          takenTimeLabel: status === 'taken' && slotLog ? this.formatTakenTime(slotLog) : undefined
        });
      }
    }

    return rows;
  });

  readonly scheduledCards = computed<ScheduledMedicationCard[]>(() => {
    const cards: ScheduledMedicationCard[] = [];
    const seen = new Set<string>();

    for (const row of this.routineRows()) {
      if (row.source !== 'scheduled' || seen.has(row.medication.id)) continue;
      seen.add(row.medication.id);

      const medRows = this.routineRows().filter(r => r.source === 'scheduled' && r.medication.id === row.medication.id);
      const frequency = this.resolveMedicationFrequency(row.medication) ?? 'once-daily';
      const expectedDoses = this.frequencySlotCount(frequency);
      const takenDoses = medRows.filter(r => r.status === 'taken').length;

      let cardStatus: 'complete' | 'partial' | 'not-taken' = 'not-taken';
      if (takenDoses >= expectedDoses) cardStatus = 'complete';
      else if (takenDoses > 0) cardStatus = 'partial';

      const nextUntaken = medRows.find(r => r.status === 'not_taken');
      let nextDoseLabel: string | null = null;
      if (nextUntaken && cardStatus === 'partial') {
        const slotLabel = this.DOSE_SLOT_LABELS[nextUntaken.occurrenceKey ?? ''] ?? 'Next';
        nextDoseLabel = `${slotLabel} dose pending`;
      }

      cards.push({ medication: row.medication, frequency, expectedDoses, takenDoses, rows: medRows, cardStatus, nextDoseLabel });
    }

    return cards;
  });

  readonly asNeededBaseRows = computed(() =>
    this.routineRows().filter(row => row.source === 'as-needed-base')
  );

  private readonly asNeededEventRowsByMedicationId = computed(() => {
    const eventMap = new Map<string, RoutineMedicationRow[]>();
    for (const row of this.routineRows()) {
      if (row.source !== 'as-needed-log') continue;
      const existing = eventMap.get(row.medication.id) ?? [];
      existing.push(row);
      eventMap.set(row.medication.id, existing);
    }
    return eventMap;
  });

  // Summary computeds (same as insights summary card)
  readonly medicationSummary = computed(() => {
    let totalExpectedDoses = 0;
    let takenDoses = 0;
    for (const med of this.routineMedications()) {
      const frequency = this.resolveMedicationFrequency(med);
      if (!frequency || frequency === 'as-needed') continue;
      const expected = this.frequencySlotCount(frequency);
      totalExpectedDoses += expected;
      const medLogs = this.todayLogs().filter(log => log.medicationId === med.id && log.status === 'taken');
      takenDoses += Math.min(medLogs.length, expected);
    }
    return { totalExpectedDoses, takenDoses };
  });

  readonly progressPercent = computed(() => {
    const { totalExpectedDoses, takenDoses } = this.medicationSummary();
    if (totalExpectedDoses === 0) return 100;
    return Math.round((takenDoses / totalExpectedDoses) * 100);
  });

  readonly progressDasharray = computed(() => `${this.progressPercent()} 100`);

  readonly adherenceStatus = computed<'complete' | 'pending' | 'none'>(() => {
    const { totalExpectedDoses, takenDoses } = this.medicationSummary();
    if (totalExpectedDoses === 0) return 'none';
    return takenDoses >= totalExpectedDoses ? 'complete' : 'pending';
  });

  constructor() {
    effect(() => {
      this.activeParticipantId();
      this.todayLocalDate();
      this.cachedMedications.set([]);
      this.cachedLogs.set([]);
      this.routineLoadedOnce.set(false);
      this.clearTimePickerState();
    }, { allowSignalWrites: true });

    effect(() => {
      if (this.medicationsResource.hasValue()) this.cachedMedications.set(this.medicationsResource.value().items);
      if (this.logsResource.hasValue()) this.cachedLogs.set(this.logsResource.value().items);
      if (this.medicationsResource.hasValue() && this.logsResource.hasValue()) this.routineLoadedOnce.set(true);
    }, { allowSignalWrites: true });

    effect(() => {
      const pickerRowId = this.timePickerRowId();
      if (!pickerRowId) return;
      const stillExists = this.routineRows().some(row => row.id === pickerRowId);
      if (!stillExists) this.clearTimePickerState();
    }, { allowSignalWrites: true });
  }

  // --- Swipe ---

  isSaving(rowId: string): boolean { return !!this.savingMap()[rowId]; }
  isSwiping(rowId: string): boolean { return !!this.swipeActiveMap()[rowId]; }
  isSwipingRight(rowId: string): boolean { return this.isSwiping(rowId) && (this.swipeOffsetMap()[rowId] ?? 0) > 0; }
  isSwipingLeft(rowId: string): boolean { return this.isSwiping(rowId) && (this.swipeOffsetMap()[rowId] ?? 0) < 0; }

  swipeTransform(rowId: string): string {
    if (!this.isSwiping(rowId)) return 'none';
    const offset = this.swipeOffsetMap()[rowId] ?? 0;
    return offset === 0 ? 'none' : `translate3d(${offset}px, 0, 0)`;
  }

  onSwipeStart(event: PointerEvent, row: RoutineMedicationRow): void {
    if (event.button !== 0 || this.isSaving(row.id)) return;
    this.onSwipeCancel(row.id);
    const surface = event.currentTarget as HTMLElement | null;
    surface?.setPointerCapture(event.pointerId);
    this.swipePointerId.set(row.id, event.pointerId);
    this.swipeStartX.set(row.id, event.clientX);
    this.swipeStartY.set(row.id, event.clientY);
    this.swipeAxisLock.set(row.id, null);
  }

  onSwipeMove(event: PointerEvent, row: RoutineMedicationRow): void {
    if (this.swipePointerId.get(row.id) !== event.pointerId) return;
    const startX = this.swipeStartX.get(row.id);
    const startY = this.swipeStartY.get(row.id);
    if (typeof startX !== 'number' || typeof startY !== 'number') return;

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    const currentAxis = this.swipeAxisLock.get(row.id);

    if (!currentAxis) {
      if (Math.abs(deltaX) < this.SWIPE_LOCK_PX && Math.abs(deltaY) < this.SWIPE_LOCK_PX) return;
      const axis = Math.abs(deltaX) >= Math.abs(deltaY) ? 'x' : 'y';
      this.swipeAxisLock.set(row.id, axis);
      if (axis === 'x') this.swipeActiveMap.update(state => ({ ...state, [row.id]: true }));
    }

    if (this.swipeAxisLock.get(row.id) === 'y') return;

    event.preventDefault();
    let clamped = Math.max(-this.SWIPE_MAX_PX, Math.min(this.SWIPE_MAX_PX, deltaX));
    if (!this.canSwipeLeft(row) && clamped < 0) clamped = 0;
    if (!this.canSwipeRight(row) && clamped > 0) clamped = 0;
    this.swipeOffsetMap.update(state => ({ ...state, [row.id]: clamped }));
  }

  onSwipeEnd(event: PointerEvent, row: RoutineMedicationRow): void {
    if (this.swipePointerId.get(row.id) !== event.pointerId) return;
    const surface = event.currentTarget as HTMLElement | null;
    if (surface?.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);

    const offset = this.isSwiping(row.id) ? (this.swipeOffsetMap()[row.id] ?? 0) : 0;
    this.onSwipeCancel(row.id);

    if (offset >= this.SWIPE_TRIGGER_PX && this.canSwipeRight(row)) { this.handleSwipeRight(row); return; }
    if (offset <= -this.SWIPE_TRIGGER_PX && this.canSwipeLeft(row)) { this.handleSwipeLeft(row); }
  }

  onSwipeCancel(rowId: string): void {
    this.swipeOffsetMap.update(state => ({ ...state, [rowId]: 0 }));
    this.swipeActiveMap.update(state => { const next = { ...state }; delete next[rowId]; return next; });
    this.swipeStartX.delete(rowId);
    this.swipeStartY.delete(rowId);
    this.swipePointerId.delete(rowId);
    this.swipeAxisLock.delete(rowId);
  }

  private canSwipeLeft(row: RoutineMedicationRow): boolean { return row.source !== 'as-needed-base'; }
  private canSwipeRight(row: RoutineMedicationRow): boolean { return row.source !== 'as-needed-log'; }

  private handleSwipeRight(row: RoutineMedicationRow): void {
    const participantId = this.activeParticipantId();
    if (!participantId) return;

    const frequency = this.resolveMedicationFrequency(row.medication);
    if (!frequency) {
      this.routineError.set('Medication frequency is missing. Update this medication in Profile.');
      return;
    }

    this.routineError.set(null);
    this.setSaving(row.id, true);
    const logLocalDate = this.todayLocalDate();
    const logLocalTime = this.currentLocalTime();
    const logTzOffsetMinutes = computeTzOffsetMinutes(logLocalDate, logLocalTime);

    if (frequency === 'as-needed') {
      this.medicationLogs
        .createAsNeededLog(participantId, row.medication.id, logLocalDate, { logLocalTime, logTzOffsetMinutes })
        .subscribe({
          next: () => { this.setSaving(row.id, false); this.refreshTick.update(v => v + 1); },
          error: () => { this.setSaving(row.id, false); this.routineError.set('Unable to log dose. Please try again.'); }
        });
      return;
    }

    const occurrenceKey = row.occurrenceKey ?? 'dose-1';
    this.medicationLogs
      .upsertLog(participantId, row.medication.id, logLocalDate, { status: 'taken', logLocalTime, logTzOffsetMinutes, occurrenceKey })
      .subscribe({
        next: () => { this.setSaving(row.id, false); this.refreshTick.update(v => v + 1); },
        error: () => { this.setSaving(row.id, false); this.routineError.set('Unable to log dose. Please try again.'); }
      });
  }

  private handleSwipeLeft(row: RoutineMedicationRow): void {
    const participantId = this.activeParticipantId();
    if (!participantId || row.source === 'as-needed-base') return;

    this.routineError.set(null);

    if (row.source === 'as-needed-log') {
      if (!row.logId) { this.routineError.set('Missing log id for this as-needed entry.'); return; }
      this.setSaving(row.id, true);
      this.medicationLogs.deleteLog(participantId, row.logId).subscribe({
        next: () => { this.setSaving(row.id, false); this.refreshTick.update(v => v + 1); },
        error: () => { this.setSaving(row.id, false); this.routineError.set('Unable to remove log. Please try again.'); }
      });
      return;
    }

    const occurrenceKey = row.occurrenceKey ?? 'dose-1';
    this.setSaving(row.id, true);
    this.medicationLogs
      .upsertLog(participantId, row.medication.id, this.todayLocalDate(), {
        status: 'not_taken', logTzOffsetMinutes: -new Date().getTimezoneOffset(), occurrenceKey
      })
      .subscribe({
        next: () => { this.setSaving(row.id, false); this.refreshTick.update(v => v + 1); },
        error: () => { this.setSaving(row.id, false); this.routineError.set('Unable to update status. Please try again.'); }
      });
  }

  // --- Time editing ---

  openTimeEditor(row: RoutineMedicationRow, event: Event): void {
    event.stopPropagation();
    if (row.status !== 'taken' || this.isSaving(row.id)) return;
    const initialValue = this.resolveEditableTimeValue(row) ?? this.currentLocalTime();
    this.routineError.set(null);
    this.timePickerRowId.set(row.id);
    this.timePickerInitialValue.set(initialValue);
    this.timePickerValue.set(initialValue);
    queueMicrotask(() => this.presentTimePicker());
  }

  onTimePickerChange(event: Event): void {
    const rowId = this.timePickerRowId();
    if (!rowId) return;
    const row = this.routineRows().find(item => item.id === rowId);
    if (!row || this.isSaving(row.id)) {
      this.clearTimePickerState();
      return;
    }

    const target = event.target as HTMLInputElement | null;
    if (!target) {
      this.clearTimePickerState();
      return;
    }
    const logLocalTime = target.value.trim();
    if (!this.isValidTimeInput(logLocalTime)) {
      this.clearTimePickerState();
      return;
    }
    if (logLocalTime === this.timePickerInitialValue()) {
      this.clearTimePickerState();
      return;
    }
    this.saveTimeEdit(row, logLocalTime);
  }

  onTimePickerBlur(): void {
    this.clearTimePickerState();
  }

  saveTimeEdit(row: RoutineMedicationRow, logLocalTime: string): void {
    if (this.isSaving(row.id)) return;
    const participantId = this.activeParticipantId();
    if (!participantId) { this.clearTimePickerState(); return; }
    if (!this.isValidTimeInput(logLocalTime)) { return; }

    const occurrenceKey = row.occurrenceKey;
    if (!occurrenceKey) { this.routineError.set('Unable to update time for this log.'); return; }

    const logLocalDate = row.logLocalDate ?? this.todayLocalDate();
    const logTzOffsetMinutes = computeTzOffsetMinutes(logLocalDate, logLocalTime);
    this.clearTimePickerState();
    this.setSaving(row.id, true);
    this.routineError.set(null);

    this.medicationLogs
      .upsertLog(participantId, row.medication.id, logLocalDate, { status: 'taken', logLocalTime, logTzOffsetMinutes, occurrenceKey })
      .subscribe({
        next: () => { this.setSaving(row.id, false); this.refreshTick.update(v => v + 1); },
        error: () => { this.setSaving(row.id, false); this.routineError.set('Unable to save time. Please try again.'); }
      });
  }

  private presentTimePicker(): void {
    const input = this.timePickerInput?.nativeElement;
    if (!input || !this.timePickerRowId()) return;

    input.value = this.timePickerValue();
    const picker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  private clearTimePickerState(): void {
    this.timePickerRowId.set(null);
    this.timePickerInitialValue.set('');
    this.timePickerValue.set('');
  }

  // --- Helpers ---

  doseSlotLabel(row: RoutineMedicationRow, card: ScheduledMedicationCard): string {
    if (card.expectedDoses <= 1) return 'Once Daily';
    return this.DOSE_SLOT_LABELS[row.occurrenceKey ?? ''] ?? 'Taken';
  }

  asNeededVisibleEventRows(medicationId: string): RoutineMedicationRow[] {
    return (this.asNeededEventRowsByMedicationId().get(medicationId) ?? []).slice(0, this.AS_NEEDED_EVENT_PREVIEW_LIMIT);
  }

  asNeededOverflowCount(medicationId: string): number {
    const total = this.asNeededEventRowsByMedicationId().get(medicationId)?.length ?? 0;
    return Math.max(0, total - this.AS_NEEDED_EVENT_PREVIEW_LIMIT);
  }

  frequencyLabel(frequency: MedicationFrequency): string {
    if (frequency === 'once-daily') return 'Once daily';
    if (frequency === 'twice-daily') return 'Twice daily';
    if (frequency === 'three-times-daily') return 'Three times daily';
    if (frequency === 'as-needed') return 'As needed';
    return 'Frequency not set';
  }

  private setSaving(id: string, value: boolean): void {
    this.savingMap.update(state => ({ ...state, [id]: value }));
  }

  private isAsNeededMedication(medication: Medication): boolean {
    return this.resolveMedicationFrequency(medication) === 'as-needed';
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
    if (frequency === 'once-daily' || frequency === 'twice-daily' || frequency === 'three-times-daily' || frequency === 'as-needed') {
      return frequency;
    }
    const frequencyText = withFrequency.frequencyText?.trim().toLowerCase();
    if (!frequencyText) return null;
    if (frequencyText.includes('as-needed') || frequencyText.includes('as needed')) return 'as-needed';
    if (frequencyText.includes('three')) return 'three-times-daily';
    if (frequencyText.includes('twice') || frequencyText.includes('2')) return 'twice-daily';
    if (frequencyText.includes('once') || frequencyText.includes('daily')) return 'once-daily';
    return null;
  }

  private logSortTimeMs(log: MedicationLog): number {
    if (log.takenAtUtc) {
      const takenAt = Date.parse(log.takenAtUtc);
      if (Number.isFinite(takenAt)) return takenAt;
    }
    if (log.logLocalTime) {
      const localAsUtc = Date.parse(`${log.logLocalDate}T${log.logLocalTime}:00.000Z`);
      if (Number.isFinite(localAsUtc)) return localAsUtc - log.logTzOffsetMinutes * 60_000;
    }
    const updated = Date.parse(log.updatedAtUtc);
    if (Number.isFinite(updated)) return updated;
    const created = Date.parse(log.createdAtUtc);
    return Number.isFinite(created) ? created : 0;
  }

  private formatTakenTime(log: MedicationLog): string | undefined {
    if (log.logLocalTime) return this.formatTimeLabel(log.logLocalTime);
    if (log.takenAtUtc) {
      const derived = this.localTimeFromUtc(log.takenAtUtc, log.logTzOffsetMinutes);
      if (derived) return this.formatTimeLabel(derived);
    }
    const utcMillis = this.logSortTimeMs(log);
    if (!Number.isFinite(utcMillis) || utcMillis <= 0) return undefined;
    const localMillis = utcMillis + log.logTzOffsetMinutes * 60_000;
    const localInstant = new Date(localMillis);
    const hh = String(localInstant.getUTCHours()).padStart(2, '0');
    const mm = String(localInstant.getUTCMinutes()).padStart(2, '0');
    return this.formatTimeLabel(`${hh}:${mm}`);
  }

  private resolveEditableTimeValue(row: RoutineMedicationRow): string | null {
    if (row.logLocalTime) return row.logLocalTime;
    if (row.takenAtUtc) return this.localTimeFromUtc(row.takenAtUtc, row.logTzOffsetMinutes ?? -new Date().getTimezoneOffset());
    return null;
  }

  private localTimeFromUtc(isoUtc: string, logTzOffsetMinutes: number): string | null {
    const utcMillis = Date.parse(isoUtc);
    if (!Number.isFinite(utcMillis)) return null;
    const localMillis = utcMillis + logTzOffsetMinutes * 60_000;
    const localInstant = new Date(localMillis);
    const hh = String(localInstant.getUTCHours()).padStart(2, '0');
    const mm = String(localInstant.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private currentLocalTime(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  private isValidTimeInput(value: string): boolean {
    if (!/^\d{2}:\d{2}$/.test(value)) return false;
    const [h, m] = value.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTimeLabel(value?: string): string {
    if (!value) return 'Time n/a';
    const [hourRaw, minuteRaw] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
  }
}
