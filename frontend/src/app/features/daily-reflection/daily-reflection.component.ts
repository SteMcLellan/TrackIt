import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionResponse } from '../../shared/models/collection';
import { DailyReflection } from '../../shared/models/daily-reflection';
import { DailyReflectionService } from '../../shared/services/daily-reflection.service';
import { ParticipantService } from '../../shared/services/participant.service';
import { environment } from '../../../environments/environment';

type DailyReflectionsResponse = CollectionResponse<DailyReflection>;
type ScoreField = 'mood' | 'focus' | 'energy' | 'sleep';

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/57dc91ea7516465ea3bb05ba8f35b7d9
 * @stitch-screen-title Daily Reflection Entry
 * @stitch-status converted
 * @stitch-last-sync 2026-02-12
 */
@Component({
  selector: 'app-daily-reflection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <h1>Daily Reflection</h1>
        <p>Track daily rhythms for consistent progress.</p>
      </header>

      <div class="cards">
        <section class="metric-card mood">
          <div class="metric-top">
            <div class="metric-icon">
              <span class="material-symbols-outlined">sentiment_satisfied</span>
            </div>
            <div>
              <h2>Mood</h2>
              <p>Interaction and reactivity levels.</p>
            </div>
            <span class="metric-value">{{ moodScore() }}</span>
          </div>
          <div class="metric-scale">
            <span>Withdrawn</span>
            <span>Overstimulated</span>
          </div>
          <input
            class="slider slider-violet"
            type="range"
            min="0"
            max="100"
            [value]="moodScore()"
            (input)="onScoreInput('mood', $event)"
          />
        </section>

        <section class="metric-card focus">
          <div class="metric-top">
            <div class="metric-icon">
              <span class="material-symbols-outlined">target</span>
            </div>
            <div>
              <h2>Focus</h2>
              <p>Ability to stay on a task or follow instructions.</p>
            </div>
            <span class="metric-value">{{ focusScore() }}</span>
          </div>
          <div class="metric-scale">
            <span>Needs Redirection</span>
            <span>Sustained Attention</span>
          </div>
          <input
            class="slider slider-amber"
            type="range"
            min="0"
            max="100"
            [value]="focusScore()"
            (input)="onScoreInput('focus', $event)"
          />
        </section>

        <section class="metric-card energy">
          <div class="metric-top">
            <div class="metric-icon">
              <span class="material-symbols-outlined">bolt</span>
            </div>
            <div>
              <h2>Energy</h2>
              <p>Physical activity and movement levels today.</p>
            </div>
            <span class="metric-value">{{ energyScore() }}</span>
          </div>
          <div class="metric-scale">
            <span>Low Drive</span>
            <span>Restless / On-the-go</span>
          </div>
          <input
            class="slider slider-azure"
            type="range"
            min="0"
            max="100"
            [value]="energyScore()"
            (input)="onScoreInput('energy', $event)"
          />
        </section>

        <section class="metric-card sleep">
          <div class="metric-top">
            <div class="metric-icon">
              <span class="material-symbols-outlined">bedtime</span>
            </div>
            <div>
              <h2>Sleep</h2>
              <p>Quality and continuity of last night's rest.</p>
            </div>
            <span class="metric-value">{{ sleepScore() }}</span>
          </div>
          <div class="metric-scale">
            <span>Frequent Night Waking</span>
            <span>Slept Through Night</span>
          </div>
          <input
            class="slider slider-emerald"
            type="range"
            min="0"
            max="100"
            [value]="sleepScore()"
            (input)="onScoreInput('sleep', $event)"
          />
        </section>

        <section class="metric-card note">
          <div class="metric-top notes-head">
            <div class="metric-icon neutral">
              <span class="material-symbols-outlined">notes</span>
            </div>
            <div>
              <h2>Journal Notes</h2>
            </div>
          </div>
          <textarea
            [value]="journalNote()"
            maxlength="2000"
            placeholder="Capture any observations, wins, or challenges from today..."
            (input)="onJournalInput($event)"
          ></textarea>
          <p class="char-count">{{ journalNote().length }}/2000</p>
        </section>
      </div>

      @if (existingReflectionResource.isLoading()) {
        <p class="status">Loading today's reflection...</p>
      }
      @if (errorMessage()) {
        <p class="error">{{ errorMessage() }}</p>
      }

      <section class="action-bar">
        <button
          class="save-button"
          type="button"
          [disabled]="isSaving() || !activeParticipantId()"
          (click)="saveReflection()"
        >
          {{ isSaving() ? 'Saving...' : 'Save Reflection' }}
        </button>
        <button class="cancel-button" type="button" [disabled]="isSaving()" (click)="cancel()">
          Cancel
        </button>
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
      padding: 1rem 1rem 11rem;
      box-sizing: border-box;
      overflow-x: hidden;
      background: #fcfcfd;
    }

    .page-head {
      display: grid;
      gap: 0.2rem;
      margin-bottom: 1rem;
    }

    h1 {
      margin: 0;
      color: #1e293b;
      font-size: 1.5rem;
      line-height: 1.2;
      letter-spacing: -0.01em;
    }

    .page-head p {
      margin: 0;
      color: #64748b;
      font-size: 0.875rem;
    }

    .cards {
      display: grid;
      gap: 0.75rem;
    }

    .metric-card {
      border-radius: 0.5rem;
      border: 1px solid #e2e8f0;
      background: #fff;
      padding: 0.9rem;
      display: grid;
      gap: 0.75rem;
    }

    .metric-top {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.65rem;
      min-width: 0;
    }

    .metric-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: rgba(139, 92, 246, 0.1);
      color: #8b5cf6;
    }

    .metric-icon.neutral {
      background: #f1f5f9;
      color: #64748b;
    }

    .focus .metric-icon {
      background: rgba(245, 158, 11, 0.1);
      color: #f59e0b;
    }

    .energy .metric-icon {
      background: rgba(14, 165, 233, 0.1);
      color: #0ea5e9;
    }

    .sleep .metric-icon {
      background: rgba(16, 185, 129, 0.1);
      color: #10b981;
    }

    h2 {
      margin: 0;
      color: #1e293b;
      font-size: 1.125rem;
      line-height: 1.2;
    }

    .metric-top p {
      margin: 0.2rem 0 0;
      color: #64748b;
      font-size: 0.75rem;
      line-height: 1.35;
    }

    .metric-value {
      color: #1e293b;
      font-size: 0.875rem;
      font-weight: 700;
      min-width: 2.25rem;
      text-align: right;
    }

    .metric-scale {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      color: #94a3b8;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .slider {
      width: 100%;
      height: 0.5rem;
      border-radius: 999px;
      appearance: none;
      background: #e2e8f0;
      cursor: pointer;
      margin: 0;
    }

    .slider::-webkit-slider-thumb {
      appearance: none;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 999px;
      border: 2px solid currentColor;
      background: #fff;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.16);
    }

    .slider::-moz-range-thumb {
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 999px;
      border: 2px solid currentColor;
      background: #fff;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.16);
    }

    .slider-violet {
      color: #8b5cf6;
    }

    .slider-amber {
      color: #f59e0b;
    }

    .slider-azure {
      color: #0ea5e9;
    }

    .slider-emerald {
      color: #10b981;
    }

    .note textarea {
      width: 100%;
      min-height: 7.5rem;
      max-width: 100%;
      resize: vertical;
      border-radius: 0.5rem;
      border: 1px solid #cbd5e1;
      padding: 0.75rem;
      box-sizing: border-box;
      font-size: 0.875rem;
      font-family: inherit;
      color: #1e293b;
      background: #fff;
    }

    .note textarea:focus {
      outline: 2px solid rgba(16, 185, 129, 0.2);
      border-color: #10b981;
    }

    .char-count {
      margin: 0;
      color: #64748b;
      font-size: 0.75rem;
      text-align: right;
    }

    .status,
    .error {
      margin: 0.75rem 0 0;
      font-size: 0.8125rem;
      line-height: 1.4;
    }

    .status {
      color: #64748b;
    }

    .error {
      color: #b91c1c;
      font-weight: 600;
    }

    .action-bar {
      position: sticky;
      bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
      margin-top: 1rem;
      padding-top: 0.75rem;
      background: linear-gradient(to top, rgba(252, 252, 253, 1), rgba(252, 252, 253, 0.92) 70%, rgba(252, 252, 253, 0));
      display: grid;
      gap: 0.65rem;
    }

    .save-button {
      min-height: 56px;
      width: 100%;
      border: none;
      border-radius: 999px;
      background: #10b981;
      color: #fff;
      font-size: 0.9375rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 10px 24px -10px rgba(16, 185, 129, 0.5);
    }

    .cancel-button {
      min-height: 44px;
      width: 100%;
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
    }

    .save-button[disabled],
    .cancel-button[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class DailyReflectionComponent {
  private readonly router = inject(Router);
  private readonly participantService = inject(ParticipantService);
  private readonly reflections = inject(DailyReflectionService);

  readonly activeParticipantId = this.participantService.activeParticipantId;
  readonly todayLocalDate = signal(this.formatLocalDate(new Date()));
  readonly moodScore = signal(50);
  readonly focusScore = signal(50);
  readonly energyScore = signal(50);
  readonly sleepScore = signal(50);
  readonly journalNote = signal('');
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isDirty = signal(false);
  private readonly seededFromExisting = signal(false);

  readonly existingReflectionResource = httpResource<DailyReflectionsResponse>(() => {
    const participantId = this.activeParticipantId();
    const date = this.todayLocalDate();
    if (!participantId) {
      return {
        url: `${environment.apiBaseUrl}/participants/unknown/daily-reflections`,
        method: 'GET',
        params: { startDate: date, endDate: date, pageSize: '1' }
      };
    }
    return {
      url: `${environment.apiBaseUrl}/participants/${participantId}/daily-reflections`,
      method: 'GET',
      params: { startDate: date, endDate: date, pageSize: '1' }
    };
  });

  readonly existingReflection = computed(() => {
    if (!this.existingReflectionResource.hasValue()) {
      return null;
    }
    return this.existingReflectionResource.value().items[0] ?? null;
  });

  constructor() {
    effect(() => {
      const reflection = this.existingReflection();
      if (!reflection || this.seededFromExisting() || this.isDirty()) {
        return;
      }
      this.moodScore.set(reflection.moodScore);
      this.focusScore.set(reflection.focusScore);
      this.energyScore.set(reflection.energyScore);
      this.sleepScore.set(reflection.sleepScore);
      this.journalNote.set(reflection.journalNote ?? '');
      this.seededFromExisting.set(true);
    });
  }

  onScoreInput(field: ScoreField, event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) {
      return;
    }
    const nextValue = Number(target.value);
    const value = Number.isFinite(nextValue) ? Math.min(100, Math.max(0, Math.round(nextValue))) : 0;
    if (field === 'mood') {
      this.moodScore.set(value);
    } else if (field === 'focus') {
      this.focusScore.set(value);
    } else if (field === 'energy') {
      this.energyScore.set(value);
    } else {
      this.sleepScore.set(value);
    }
    this.isDirty.set(true);
  }

  onJournalInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    if (!target) {
      return;
    }
    this.journalNote.set(target.value.slice(0, 2000));
    this.isDirty.set(true);
  }

  saveReflection(): void {
    const participantId = this.activeParticipantId();
    if (!participantId || this.isSaving()) {
      return;
    }

    this.errorMessage.set(null);
    this.isSaving.set(true);
    const logLocalDate = this.todayLocalDate();

    this.reflections.upsertReflection(participantId, logLocalDate, {
      logTzOffsetMinutes: -new Date().getTimezoneOffset(),
      moodScore: this.moodScore(),
      focusScore: this.focusScore(),
      energyScore: this.energyScore(),
      sleepScore: this.sleepScore(),
      journalNote: this.journalNote().trim() || undefined
    }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.router.navigate(['/insights']);
      },
      error: () => {
        this.isSaving.set(false);
        this.errorMessage.set('Unable to save reflection. Please try again.');
      }
    });
  }

  cancel(): void {
    if (this.isSaving()) {
      return;
    }
    this.router.navigate(['/insights']);
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
