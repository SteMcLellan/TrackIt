import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionResponse } from '../../shared/models/collection';
import { MedicationLog } from '../../shared/models/medication-log';
import { IntervalSchedule, Medication, MedicationFrequency } from '../../shared/models/medication';
import { MedicationLogService } from '../../shared/services/medication-log.service';
import { ParticipantService } from '../../shared/services/participant.service';
import { computeTzOffsetMinutes } from '../../shared/utils/datetime';
import { medicationDaypartFromDate, medicationDaypartFromLocalTime } from '../../shared/utils/medication-daypart';
import { environment } from '../../../environments/environment';

type MedicationsResponse = CollectionResponse<Medication>;
type MedicationLogsResponse = CollectionResponse<MedicationLog>;

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

type IntervalDueState = 'early' | 'due' | 'overdue';

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
      @if (isOutOfWindow) {
        <div class="out-of-window-banner">
          <p>This date is outside the 30-day medication logging window.</p>
          <button class="out-of-window-back" type="button" (click)="navigateBack()">Return to Timeline</button>
        </div>
      }
      @if (isBackfill && !isOutOfWindow) {
        <header class="backfill-header">
          <button class="back-btn" type="button" (click)="navigateBack()">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <p class="backfill-date-label">{{ dateContextLabel() }}</p>
        </header>
      }

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
            <p class="summary-title">{{ isBackfill ? backfillDateShortLabel() + ' Medications' : "Today's Medications" }}</p>
            @if (medicationSummary().totalExpectedDoses === 0 && medicationSummary().intervalActionableCount === 0) {
              <p class="summary-fraction">No scheduled doses today</p>
            } @else if (medicationSummary().totalExpectedDoses === 0) {
              <p class="summary-fraction">{{ medicationSummary().nearestIntervalDueLabel }}</p>
            } @else {
              <p class="summary-fraction">
                {{ medicationSummary().takenDoses }} of {{ medicationSummary().totalExpectedDoses }} doses taken
              </p>
              @if (medicationSummary().nearestIntervalDueLabel) {
                <p class="summary-fraction">{{ medicationSummary().nearestIntervalDueLabel }}</p>
              }
            }
          </div>
        </div>
        <div class="summary-trailing">
          @if (adherenceStatus() === 'complete') {
            <span class="summary-chip complete">All on track</span>
          } @else if (adherenceStatus() === 'pending') {
            <span class="summary-chip pending">
              {{ medicationSummary().totalExpectedDoses - medicationSummary().takenDoses + medicationSummary().intervalActionableCount }} remaining
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
                    <p class="med-subtitle">{{ card.medication.dosageText }} · {{ medicationFrequencyLabel(card.medication) }}</p>
                  </div>
                  <div class="status-meta">
                    @if (isIntervalMedication(card.medication)) {
                      <span class="status-chip"
                        [class.taken]="intervalDueState(card.medication) === 'early'"
                        [class.pending]="intervalDueState(card.medication) === 'due'"
                        [class.not-taken]="intervalDueState(card.medication) === 'overdue'">
                        {{ intervalDueChipLabel(card.medication) }}
                      </span>
                    } @else if (card.cardStatus === 'complete') {
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
                @if (isIntervalMedication(card.medication)) {
                  <p class="interval-meta">
                    Last logged: {{ intervalLastTakenLabel(card.medication) }} - Next due: {{ intervalNextDueLabel(card.medication) }}
                  </p>
                }
                @for (row of card.rows; track row.id) {
                  <div
                    class="swipe-item dose-swipe-item"
                    [class.reveal-actions]="isSwiping(row.id)"
                    [class.reveal-right]="isSwipingRight(row.id)"
                    [class.reveal-left]="isSwipingLeft(row.id)"
                  >
                    <div class="swipe-rail rail-right">
                      <span class="material-symbols-outlined">check_circle</span>
                      <span>Mark taken</span>
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
                          @if (timePickerRowId() === row.id) {
                            <input
                              class="inline-time-picker"
                              type="time"
                              [value]="timePickerValue()"
                              (blur)="onTimePickerBlur($event)"
                              (pointerdown)="$event.stopPropagation()"
                            />
                          } @else {
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
                          }
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
                        @if (timePickerRowId() === eventRow.id) {
                          <input
                            class="inline-time-picker"
                            type="time"
                            [value]="timePickerValue()"
                            (blur)="onTimePickerBlur($event)"
                            (pointerdown)="$event.stopPropagation()"
                          />
                        } @else {
                          <span class="taken-time-copy">
                            {{ asNeededTakenLabel(eventRow) }} — {{ eventRow.takenTimeLabel ?? 'Time n/a' }}
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
                        }
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

    /* Backfill header */

    .out-of-window-banner {
      margin-bottom: 1rem;
      padding: 0.85rem 1rem;
      border-radius: 0.5rem;
      background: #fef2f2;
      border: 1px solid rgba(185, 28, 28, 0.2);
      display: grid;
      gap: 0.5rem;
    }

    .out-of-window-banner p {
      margin: 0;
      color: #b91c1c;
      font-size: 0.8125rem;
      font-weight: 600;
    }

    .out-of-window-back {
      align-self: start;
      border: none;
      background: transparent;
      color: #b91c1c;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
    }

    .backfill-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .back-btn {
      width: 36px;
      height: 36px;
      border-radius: 999px;
      border: 1px solid #e2e8f0;
      background: #fff;
      color: #64748b;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      padding: 0;
    }

    .back-btn .material-symbols-outlined {
      font-size: 1.125rem;
      line-height: 1;
    }

    .backfill-date-label {
      margin: 0;
      color: #1e293b;
      font-size: 0.9375rem;
      font-weight: 700;
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

    .interval-meta {
      margin: 0;
      padding: 0 1rem 0.6rem;
      color: #64748b;
      font-size: 0.6875rem;
      font-weight: 500;
      border-top: 1px solid #f8fafc;
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

    .inline-time-picker {
      font-size: 0.6875rem;
      font-family: inherit;
      border: 1px solid #10b981;
      border-radius: 4px;
      padding: 0.15rem 0.25rem;
      outline: none;
      color: #1e293b;
      background: #f0fdf4;
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
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private readonly participantService = inject(ParticipantService);
  private readonly medicationLogs = inject(MedicationLogService);
  readonly activeParticipantId = this.participantService.activeParticipantId;
  private readonly _dateResolution = this.resolveDateParam();
  readonly todayLocalDate = signal(this._dateResolution.date);
  readonly isBackfill = this._dateResolution.isBackfill;
  readonly isOutOfWindow = this._dateResolution.isOutOfWindow;

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

      if (this.isIntervalMedication(medication)) {
        const intervalLog = medicationLogs.find((log) => log.occurrenceKey === 'interval');
        const status: 'taken' | 'not_taken' = intervalLog?.status === 'taken' ? 'taken' : 'not_taken';
        rows.push({
          id: `routine_${medication.id}_interval`,
          medication,
          source: 'scheduled',
          status,
          logId: intervalLog?.id,
          logLocalDate: intervalLog?.logLocalDate,
          logLocalTime: intervalLog?.logLocalTime,
          logTzOffsetMinutes: intervalLog?.logTzOffsetMinutes,
          takenAtUtc: intervalLog?.takenAtUtc,
          occurrenceKey: 'interval',
          takenTimeLabel: status === 'taken' && intervalLog ? this.formatTakenTime(intervalLog) : undefined
        });
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
        const slotLabel = this.slotLabelFromOccurrenceKey(nextUntaken.occurrenceKey);
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
    let intervalActionableCount = 0;
    let intervalMedicationCount = 0;
    let nearestIntervalDeltaDays: number | null = null;
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
        if (this.intervalDueState(med) !== 'early') {
          intervalActionableCount += 1;
        }
        continue;
      }
      const expected = this.frequencySlotCount(frequency);
      totalExpectedDoses += expected;
      const medLogs = this.todayLogs().filter(log => log.medicationId === med.id && log.status === 'taken');
      takenDoses += Math.min(medLogs.length, expected);
    }
    const nearestIntervalDueLabel = intervalMedicationCount > 0
      ? this.intervalLabelFromDeltaDays(nearestIntervalDeltaDays ?? 0)
      : null;
    return { totalExpectedDoses, takenDoses, intervalActionableCount, nearestIntervalDueLabel };
  });

  readonly progressPercent = computed(() => {
    const { totalExpectedDoses, takenDoses, intervalActionableCount } = this.medicationSummary();
    if (totalExpectedDoses === 0) return intervalActionableCount > 0 ? 0 : 100;
    return Math.round((takenDoses / totalExpectedDoses) * 100);
  });

  readonly progressDasharray = computed(() => `${this.progressPercent()} 100`);

  readonly adherenceStatus = computed<'complete' | 'pending' | 'none'>(() => {
    const { totalExpectedDoses, takenDoses, intervalActionableCount } = this.medicationSummary();
    if (totalExpectedDoses === 0 && intervalActionableCount === 0) return 'none';
    if (intervalActionableCount > 0 || takenDoses < totalExpectedDoses) return 'pending';
    return 'complete';
  });

  constructor() {
    if (this.isOutOfWindow) {
      Promise.resolve().then(() => this.router.navigate(['/timeline'], { replaceUrl: true }));
    }

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

    const occurrenceKey = this.resolveOccurrenceKeyForRow(row);
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

    const occurrenceKey = this.resolveOccurrenceKeyForRow(row);
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
  }

  onTimePickerBlur(event: Event): void {
    const rowId = this.timePickerRowId();
    if (!rowId) { this.clearTimePickerState(); return; }
    const row = this.routineRows().find(item => item.id === rowId);
    if (!row || this.isSaving(row.id)) { this.clearTimePickerState(); return; }

    const target = event.target as HTMLInputElement | null;
    const logLocalTime = target?.value.trim() ?? '';
    if (this.isValidTimeInput(logLocalTime) && logLocalTime !== this.timePickerInitialValue()) {
      this.saveTimeEdit(row, logLocalTime);
    } else {
      this.clearTimePickerState();
    }
  }

  saveTimeEdit(row: RoutineMedicationRow, logLocalTime: string): void {
    if (this.isSaving(row.id)) return;
    const participantId = this.activeParticipantId();
    if (!participantId) { this.clearTimePickerState(); return; }
    if (!this.isValidTimeInput(logLocalTime)) { return; }

    const occurrenceKey = this.resolveOccurrenceKeyForRow(row);
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

  private clearTimePickerState(): void {
    this.timePickerRowId.set(null);
    this.timePickerInitialValue.set('');
    this.timePickerValue.set('');
  }

  // --- Helpers ---

  doseSlotLabel(row: RoutineMedicationRow, card: ScheduledMedicationCard): string {
    if (card.frequency === 'interval-days') {
      return row.status === 'taken' ? 'Logged' : 'Mark taken';
    }
    if (card.expectedDoses <= 1) return 'Once daily';
    if (row.status === 'taken') {
      const daypart = this.daypartLabelForRow(row);
      if (daypart) return daypart;
    }
    return this.slotLabelFromOccurrenceKey(row.occurrenceKey);
  }

  asNeededVisibleEventRows(medicationId: string): RoutineMedicationRow[] {
    return (this.asNeededEventRowsByMedicationId().get(medicationId) ?? []).slice(0, this.AS_NEEDED_EVENT_PREVIEW_LIMIT);
  }

  asNeededOverflowCount(medicationId: string): number {
    const total = this.asNeededEventRowsByMedicationId().get(medicationId)?.length ?? 0;
    return Math.max(0, total - this.AS_NEEDED_EVENT_PREVIEW_LIMIT);
  }

  asNeededTakenLabel(row: RoutineMedicationRow): string {
    return this.daypartLabelForRow(row) ?? 'Dose logged';
  }

  medicationFrequencyLabel(medication: Medication): string {
    const frequency = this.resolveMedicationFrequency(medication);
    if (!frequency) {
      return 'Frequency not set';
    }
    if (frequency === 'once-daily') return 'Once daily';
    if (frequency === 'twice-daily') return 'Twice daily';
    if (frequency === 'three-times-daily') return 'Three times daily';
    if (frequency === 'interval-days') {
      const intervalDays = medication.intervalSchedule?.intervalDays ?? 7;
      return `Every ${intervalDays} days`;
    }
    if (frequency === 'as-needed') return 'As needed';
    return 'Frequency not set';
  }

  private setSaving(id: string, value: boolean): void {
    this.savingMap.update(state => ({ ...state, [id]: value }));
  }

  private isAsNeededMedication(medication: Medication): boolean {
    return this.resolveMedicationFrequency(medication) === 'as-needed';
  }

  isIntervalMedication(medication: Medication): boolean {
    return this.resolveMedicationFrequency(medication) === 'interval-days';
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

  intervalDueState(medication: Medication): IntervalDueState {
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

  intervalDueChipLabel(medication: Medication): string {
    const nextDueLocalDate = this.intervalNextDueLocalDate(medication);
    if (!nextDueLocalDate) {
      return 'Due now';
    }
    const deltaDays = this.daysBetweenLocalDates(this.todayLocalDate(), nextDueLocalDate);
    if (deltaDays === null || deltaDays === 0) {
      return 'Due today';
    }
    if (deltaDays < 0) {
      const days = Math.abs(deltaDays);
      return `Due in ${days} day${days === 1 ? '' : 's'}`;
    }
    return `Overdue by ${deltaDays} day${deltaDays === 1 ? '' : 's'}`;
  }

  intervalLastTakenLabel(medication: Medication): string {
    const anchorDateLocal = this.intervalScheduleFor(medication)?.anchorDateLocal;
    if (!anchorDateLocal) {
      return 'Not logged';
    }
    return this.formatDateLabel(anchorDateLocal);
  }

  intervalNextDueLabel(medication: Medication): string {
    const nextDueLocalDate = this.intervalNextDueLocalDate(medication);
    if (!nextDueLocalDate) {
      return 'After first log';
    }
    return this.formatDateLabel(nextDueLocalDate);
  }

  private resolveOccurrenceKeyForRow(row: RoutineMedicationRow): string {
    const frequency = this.resolveMedicationFrequency(row.medication);
    if (frequency === 'interval-days') {
      return 'interval';
    }
    return row.occurrenceKey ?? 'dose-1';
  }

  private intervalScheduleFor(medication: Medication): IntervalSchedule | null {
    if (!this.isIntervalMedication(medication)) {
      return null;
    }
    const schedule = medication.intervalSchedule;
    if (!schedule || typeof schedule.intervalDays !== 'number' || schedule.intervalDays < 2 || schedule.intervalDays > 30) {
      return null;
    }
    return schedule;
  }

  private intervalNextDueLocalDate(medication: Medication): string | null {
    const schedule = this.intervalScheduleFor(medication);
    if (!schedule?.anchorDateLocal) {
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

  private formatDateLabel(localDate: string): string {
    const parsed = new Date(`${localDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return localDate;
    }
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsed);
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

  private daypartLabelForRow(row: RoutineMedicationRow): string | null {
    if (row.logLocalTime) {
      return medicationDaypartFromLocalTime(row.logLocalTime);
    }
    if (row.takenAtUtc && row.logTzOffsetMinutes !== undefined) {
      const utcMillis = Date.parse(row.takenAtUtc);
      if (Number.isFinite(utcMillis)) {
        const localMillis = utcMillis + row.logTzOffsetMinutes * 60_000;
        return medicationDaypartFromDate(new Date(localMillis));
      }
    }
    return null;
  }

  private slotLabelFromOccurrenceKey(occurrenceKey?: string): string {
    return this.DOSE_SLOT_LABELS[occurrenceKey ?? ''] ?? 'Next';
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

  navigateBack(): void {
    this.router.navigate(['/timeline']);
  }

  dateContextLabel(): string {
    const date = new Date(`${this.todayLocalDate()}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `Medications for ${weekday}, ${monthDay}`;
  }

  backfillDateShortLabel(): string {
    const date = new Date(`${this.todayLocalDate()}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private resolveDateParam(): { date: string; isBackfill: boolean; isOutOfWindow: boolean } {
    const today = this.formatLocalDate(new Date());
    const param = this.route.snapshot.queryParamMap.get('date');
    if (!param || !/^\d{4}-\d{2}-\d{2}$/.test(param)) {
      return { date: today, isBackfill: false, isOutOfWindow: false };
    }
    const parsed = new Date(`${param}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return { date: today, isBackfill: false, isOutOfWindow: false };
    }
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 29);
    const cutoff = this.formatLocalDate(cutoffDate);
    if (param < cutoff) {
      return { date: today, isBackfill: true, isOutOfWindow: true };
    }
    return { date: param, isBackfill: param !== today, isOutOfWindow: false };
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




