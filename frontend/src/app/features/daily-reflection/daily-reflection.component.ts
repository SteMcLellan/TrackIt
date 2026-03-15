import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionResponse } from '../../shared/models/collection';
import { DailyReflection } from '../../shared/models/daily-reflection';
import { DailyReflectionService } from '../../shared/services/daily-reflection.service';
import { ParticipantService } from '../../shared/services/participant.service';
import { environment } from '../../../environments/environment';

type DailyReflectionsResponse = CollectionResponse<DailyReflection>;
type ScoreField = 'mood' | 'focus' | 'energy' | 'sleep';
type BucketOption = { bucket: number; score: number; label: string; microcopy: string };

const MOOD_BUCKETS: BucketOption[] = [
  { bucket: 1, score: 10, label: 'Struggling',
    microcopy: 'Meltdowns, shutdowns, or persistent distress through the day.' },
  { bucket: 2, score: 30, label: 'Irritable',
    microcopy: 'More reactive or flat than usual — quick to frustrate or disengage.' },
  { bucket: 3, score: 50, label: 'Steady',
    microcopy: 'Typical ups and downs — nothing stood out.' },
  { bucket: 4, score: 70, label: 'Upbeat',
    microcopy: 'Mostly positive, cooperative, and rolling with things.' },
  { bucket: 5, score: 90, label: 'Thriving',
    microcopy: 'Genuinely happy, engaged, and rolling with challenges.' },
];

const FOCUS_BUCKETS: BucketOption[] = [
  { bucket: 1, score: 10, label: 'Scattered',
    microcopy: "Couldn't get started or stay on anything — constant redirection to make any progress." },
  { bucket: 2, score: 30, label: 'Drifting',
    microcopy: 'Started tasks but drifted off repeatedly — needed regular reminders to get back on track.' },
  { bucket: 3, score: 50, label: 'Typical',
    microcopy: 'Some distractibility but managed to get things done.' },
  { bucket: 4, score: 70, label: 'Dialed In',
    microcopy: 'Stayed on task well with minimal prompting.' },
  { bucket: 5, score: 90, label: 'Locked In',
    microcopy: 'Unusually sustained attention across activities.' },
];

const ENERGY_BUCKETS: BucketOption[] = [
  { bucket: 1, score: 10, label: 'Drained',
    microcopy: 'Lethargic or listless — hard to get going or stay engaged.' },
  { bucket: 2, score: 30, label: 'Sluggish',
    microcopy: 'Slow to start or faded early — less pep than usual.' },
  { bucket: 3, score: 50, label: 'Level',
    microcopy: 'Normal energy throughout the day.' },
  { bucket: 4, score: 70, label: 'Buzzing',
    microcopy: 'Noticeably more active and on-the-go than usual.' },
  { bucket: 5, score: 90, label: 'Wired',
    microcopy: "Noticeably restless or hyperactive — hard to settle or channel the energy." },
];

const SLEEP_BUCKETS: BucketOption[] = [
  { bucket: 1, score: 10, label: 'Rough Night',
    microcopy: 'Barely slept — major trouble falling or staying asleep.' },
  { bucket: 2, score: 30, label: 'Restless',
    microcopy: "Woke frequently, tossed and turned, or didn't get enough hours." },
  { bucket: 3, score: 50, label: 'Fine',
    microcopy: 'Typical night — nothing unusual to note.' },
  { bucket: 4, score: 70, label: 'Solid',
    microcopy: 'Fell asleep easily and stayed asleep through the night.' },
  { bucket: 5, score: 90, label: 'Refreshed',
    microcopy: 'Woke up bright-eyed and clearly well-rested.' },
];

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/57dc91ea7516465ea3bb05ba8f35b7d9
 * @stitch-screen-title Daily Reflection Entry
 * @stitch-status pending
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

      @if (dateContextLabel()) {
        <div class="date-context-banner">{{ dateContextLabel() }}</div>
      }

      <div class="cards">
        <section class="metric-card mood">
          <div class="metric-header">
            <div class="metric-icon">
              <span class="material-symbols-outlined">sentiment_satisfied</span>
            </div>
            <h2>Mood</h2>
          </div>
          <div class="bucket-list">
            @for (opt of moodBuckets; track opt.score) {
              <button
                class="bucket-option"
                [class.selected]="moodScore() === opt.score"
                type="button"
                (click)="onBucketSelect('mood', opt.score)"
              >
                <span class="bucket-label">{{ opt.label }}</span>
                <span class="bucket-copy">{{ opt.microcopy }}</span>
              </button>
            }
          </div>
          @if (!seededFromExisting() && !isDirty()) {
            <p class="default-hint">If you're unsure, the middle option means a typical day. Adjust if something stood out.</p>
          }
        </section>

        <section class="metric-card focus">
          <div class="metric-header">
            <div class="metric-icon">
              <span class="material-symbols-outlined">target</span>
            </div>
            <h2>Focus</h2>
          </div>
          <div class="bucket-list">
            @for (opt of focusBuckets; track opt.score) {
              <button
                class="bucket-option"
                [class.selected]="focusScore() === opt.score"
                type="button"
                (click)="onBucketSelect('focus', opt.score)"
              >
                <span class="bucket-label">{{ opt.label }}</span>
                <span class="bucket-copy">{{ opt.microcopy }}</span>
              </button>
            }
          </div>
          @if (!seededFromExisting() && !isDirty()) {
            <p class="default-hint">If you're unsure, the middle option means a typical day. Adjust if something stood out.</p>
          }
        </section>

        <section class="metric-card energy">
          <div class="metric-header">
            <div class="metric-icon">
              <span class="material-symbols-outlined">bolt</span>
            </div>
            <h2>Energy</h2>
          </div>
          <div class="bucket-list">
            @for (opt of energyBuckets; track opt.score) {
              <button
                class="bucket-option"
                [class.selected]="energyScore() === opt.score"
                type="button"
                (click)="onBucketSelect('energy', opt.score)"
              >
                <span class="bucket-label">{{ opt.label }}</span>
                <span class="bucket-copy">{{ opt.microcopy }}</span>
              </button>
            }
          </div>
          @if (!seededFromExisting() && !isDirty()) {
            <p class="default-hint">If you're unsure, the middle option means a typical day. Adjust if something stood out.</p>
          }
        </section>

        <section class="metric-card sleep">
          <div class="metric-header">
            <div class="metric-icon">
              <span class="material-symbols-outlined">bedtime</span>
            </div>
            <h2>Sleep</h2>
          </div>
          <div class="bucket-list">
            @for (opt of sleepBuckets; track opt.score) {
              <button
                class="bucket-option"
                [class.selected]="sleepScore() === opt.score"
                type="button"
                (click)="onBucketSelect('sleep', opt.score)"
              >
                <span class="bucket-label">{{ opt.label }}</span>
                <span class="bucket-copy">{{ opt.microcopy }}</span>
              </button>
            }
          </div>
          @if (!seededFromExisting() && !isDirty()) {
            <p class="default-hint">If you're unsure, the middle option means a typical day. Adjust if something stood out.</p>
          }
        </section>

        <section class="metric-card note">
          <div class="metric-header notes-head">
            <div class="metric-icon neutral">
              <span class="material-symbols-outlined">notes</span>
            </div>
            <h2>Journal Notes</h2>
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
        <p class="status">{{ isBackfill ? 'Loading reflection...' : "Loading today's reflection..." }}</p>
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
      padding: 1rem 1rem 2rem;
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

    .date-context-banner {
      margin: 0 0 0.75rem;
      padding: 0.6rem 0.85rem;
      border-radius: 0.5rem;
      background: #ecfdf5;
      border: 1px solid rgba(16, 185, 129, 0.25);
      color: #059669;
      font-size: 0.8125rem;
      font-weight: 600;
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

    .metric-header {
      display: grid;
      grid-template-columns: auto 1fr;
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

    .bucket-list {
      display: grid;
      gap: 0.5rem;
    }

    .bucket-option {
      width: 100%;
      text-align: left;
      padding: 0.75rem 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      background: #fff;
      cursor: pointer;
      display: grid;
      gap: 0.2rem;
      min-height: 44px;
      transition: background 120ms ease, border-color 120ms ease;
    }

    .bucket-label {
      font-weight: 600;
      font-size: 0.875rem;
      color: #1e293b;
    }

    .bucket-copy {
      font-size: 0.75rem;
      color: #64748b;
      line-height: 1.4;
    }

    .mood .bucket-option.selected {
      background: rgba(139, 92, 246, 0.08);
      border-color: #8b5cf6;
    }

    .focus .bucket-option.selected {
      background: rgba(245, 158, 11, 0.08);
      border-color: #f59e0b;
    }

    .energy .bucket-option.selected {
      background: rgba(14, 165, 233, 0.08);
      border-color: #0ea5e9;
    }

    .sleep .bucket-option.selected {
      background: rgba(16, 185, 129, 0.08);
      border-color: #10b981;
    }

    .default-hint {
      margin: 0;
      color: #94a3b8;
      font-size: 0.75rem;
      line-height: 1.4;
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
      margin-top: 1rem;
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly participantService = inject(ParticipantService);
  private readonly reflections = inject(DailyReflectionService);

  readonly activeParticipantId = this.participantService.activeParticipantId;
  readonly logLocalDate = signal(this.resolveLogLocalDate());
  readonly isBackfill = this.logLocalDate() !== this.formatLocalDate(new Date());
  readonly dateContextLabel = computed(() => this.formatDateContextLabel(this.logLocalDate()));
  readonly moodScore = signal<number | null>(50);
  readonly focusScore = signal<number | null>(50);
  readonly energyScore = signal<number | null>(50);
  readonly sleepScore = signal<number | null>(50);
  readonly journalNote = signal('');
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isDirty = signal(false);
  readonly seededFromExisting = signal(false);

  readonly moodBuckets = MOOD_BUCKETS;
  readonly focusBuckets = FOCUS_BUCKETS;
  readonly energyBuckets = ENERGY_BUCKETS;
  readonly sleepBuckets = SLEEP_BUCKETS;

  readonly existingReflectionResource = httpResource<DailyReflectionsResponse>(() => {
    const participantId = this.activeParticipantId();
    const date = this.logLocalDate();
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

  onBucketSelect(field: ScoreField, score: number): void {
    if (field === 'mood') this.moodScore.set(score);
    else if (field === 'focus') this.focusScore.set(score);
    else if (field === 'energy') this.energyScore.set(score);
    else this.sleepScore.set(score);
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
    const logLocalDate = this.logLocalDate();

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
        this.router.navigate([this.isBackfill ? '/timeline' : '/insights']);
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
    this.router.navigate([this.isBackfill ? '/timeline' : '/insights']);
  }

  private resolveLogLocalDate(): string {
    const today = this.formatLocalDate(new Date());
    const param = this.route.snapshot.queryParamMap.get('date');
    if (!param || !/^\d{4}-\d{2}-\d{2}$/.test(param)) {
      return today;
    }
    const parsed = new Date(`${param}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? today : param;
  }

  private formatDateContextLabel(logLocalDate: string): string | null {
    const today = this.formatLocalDate(new Date());
    if (logLocalDate === today) return null;
    const parsed = new Date(`${logLocalDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    const weekday = parsed.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `Reflecting on ${weekday}, ${monthDay}`;
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
