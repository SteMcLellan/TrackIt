import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionResponse } from '../../shared/models/collection';
import { DailyReflection } from '../../shared/models/daily-reflection';
import { DailyReflectionService } from '../../shared/services/daily-reflection.service';
import { ParticipantService } from '../../shared/services/participant.service';
import { environment } from '../../../environments/environment';
import { formatLocalDate } from '../../shared/utils/datetime';

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

        <section class="metric-row mood">
          <div class="row-head">
            <div class="row-icon"><span class="material-symbols-outlined">sentiment_satisfied</span></div>
            <h2>Mood</h2>
            @if (moodLabel()) {
              <span class="selected-badge mood-badge">{{ moodLabel() }}</span>
            }
          </div>
          <div class="chip-row">
            @for (opt of moodBuckets; track opt.score) {
              <button class="chip-opt" [class.selected]="moodScore() === opt.score" type="button" (click)="onBucketSelect('mood', opt.score)">
                <div class="chip-dot"></div>
                <span class="chip-label">{{ opt.label }}</span>
              </button>
            }
          </div>
        </section>

        <section class="metric-row focus">
          <div class="row-head">
            <div class="row-icon"><span class="material-symbols-outlined">center_focus_strong</span></div>
            <h2>Focus</h2>
            @if (focusLabel()) {
              <span class="selected-badge focus-badge">{{ focusLabel() }}</span>
            }
          </div>
          <div class="chip-row">
            @for (opt of focusBuckets; track opt.score) {
              <button class="chip-opt" [class.selected]="focusScore() === opt.score" type="button" (click)="onBucketSelect('focus', opt.score)">
                <div class="chip-dot"></div>
                <span class="chip-label">{{ opt.label }}</span>
              </button>
            }
          </div>
        </section>

        <section class="metric-row energy">
          <div class="row-head">
            <div class="row-icon"><span class="material-symbols-outlined">bolt</span></div>
            <h2>Energy</h2>
            @if (energyLabel()) {
              <span class="selected-badge energy-badge">{{ energyLabel() }}</span>
            }
          </div>
          <div class="chip-row">
            @for (opt of energyBuckets; track opt.score) {
              <button class="chip-opt" [class.selected]="energyScore() === opt.score" type="button" (click)="onBucketSelect('energy', opt.score)">
                <div class="chip-dot"></div>
                <span class="chip-label">{{ opt.label }}</span>
              </button>
            }
          </div>
        </section>

        <section class="metric-row sleep">
          <div class="row-head">
            <div class="row-icon"><span class="material-symbols-outlined">bedtime</span></div>
            <h2>Sleep</h2>
            @if (sleepLabel()) {
              <span class="selected-badge sleep-badge">{{ sleepLabel() }}</span>
            }
          </div>
          <div class="chip-row">
            @for (opt of sleepBuckets; track opt.score) {
              <button class="chip-opt" [class.selected]="sleepScore() === opt.score" type="button" (click)="onBucketSelect('sleep', opt.score)">
                <div class="chip-dot"></div>
                <span class="chip-label">{{ opt.label }}</span>
              </button>
            }
          </div>
        </section>

        <section class="metric-row note">
          <div class="row-head">
            <div class="row-icon neutral"><span class="material-symbols-outlined">notes</span></div>
            <h2>Journal Notes</h2>
            <span class="optional-label">Optional</span>
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
      padding: 1rem 1rem 9rem;
      box-sizing: border-box;
      overflow-x: clip;
      background: var(--color-ghost-white-canvas, #fcfcfd);
    }

    .page-head {
      display: grid;
      gap: 0.2rem;
      margin-bottom: 0.875rem;
    }

    h1 {
      margin: 0;
      color: var(--color-midnight-slate, #1e293b);
      font-size: 1.5rem;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }

    .page-head p {
      margin: 0;
      color: var(--color-text-muted, #64748b);
      font-size: 0.8125rem;
    }

    .date-context-banner {
      margin: 0 0 0.75rem;
      padding: 0.55rem 0.85rem;
      border-radius: 0.5rem;
      background: var(--color-soft-emerald, #ecfdf5);
      border: 1px solid color-mix(in srgb, var(--color-vital-emerald) 25%, transparent);
      color: #059669;
      font-size: 0.8125rem;
      font-weight: 600;
    }

    .cards {
      display: grid;
      gap: 0.625rem;
      padding-bottom: 0.5rem;
    }

    .metric-row {
      background: #fff;
      border-radius: 0.875rem;
      border: 1px solid var(--color-border, #e2e8f0);
      padding: 0.75rem 0.875rem 0.875rem;
      display: grid;
      gap: 0.75rem;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
    }

    .row-head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .row-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .row-icon .material-symbols-outlined { font-size: 15px; }

    .row-icon.neutral { background: #f1f5f9; color: var(--color-text-muted, #64748b); }
    .mood .row-icon   { background: color-mix(in srgb, var(--color-electric-violet) 10%, transparent); color: var(--color-electric-violet, #8b5cf6); }
    .focus .row-icon  { background: color-mix(in srgb, var(--color-vital-emerald) 10%, transparent); color: var(--color-vital-emerald, #10b981); }
    .energy .row-icon { background: color-mix(in srgb, var(--color-energetic-amber) 10%, transparent); color: var(--color-energetic-amber, #f59e0b); }
    .sleep .row-icon  { background: color-mix(in srgb, var(--color-sky-azure) 10%, transparent); color: var(--color-sky-azure, #0ea5e9); }

    h2 {
      margin: 0;
      color: var(--color-midnight-slate, #1e293b);
      font-size: 0.875rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .selected-badge {
      margin-left: auto;
      border-radius: 999px;
      padding: 0.2rem 0.55rem;
      font-size: 0.6875rem;
      font-weight: 700;
      border: 1px solid transparent;
    }

    .mood-badge   { background: color-mix(in srgb, var(--color-electric-violet) 10%, transparent); color: var(--color-electric-violet, #8b5cf6); border-color: color-mix(in srgb, var(--color-electric-violet) 20%, transparent); }
    .focus-badge  { background: color-mix(in srgb, var(--color-vital-emerald) 10%, transparent); color: var(--color-vital-emerald, #10b981); border-color: color-mix(in srgb, var(--color-vital-emerald) 20%, transparent); }
    .energy-badge { background: color-mix(in srgb, var(--color-energetic-amber) 10%, transparent); color: var(--color-energetic-amber, #f59e0b); border-color: color-mix(in srgb, var(--color-energetic-amber) 20%, transparent); }
    .sleep-badge  { background: color-mix(in srgb, var(--color-sky-azure) 10%, transparent); color: var(--color-sky-azure, #0ea5e9); border-color: color-mix(in srgb, var(--color-sky-azure) 20%, transparent); }

    .optional-label {
      margin-left: auto;
      font-size: 0.6875rem;
      color: #94a3b8;
      font-weight: 500;
    }

    .chip-row {
      display: flex;
      gap: 0.375rem;
    }

    .chip-opt {
      flex: 1;
      padding: 7px 2px 8px;
      border-radius: 10px;
      cursor: pointer;
      border: 1.5px solid var(--color-border, #e2e8f0);
      background: #fafafa;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      min-height: 44px;
      transition: border-color 120ms ease, background 120ms ease;
    }

    .chip-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--color-border, #e2e8f0);
      transition: background 120ms ease;
    }

    .chip-label {
      font-size: 0.53rem;
      font-weight: 700;
      color: #94a3b8;
      text-align: center;
      line-height: 1.2;
      letter-spacing: -0.01em;
    }

    .mood   .chip-opt.selected { border-color: var(--color-electric-violet, #8b5cf6); background: color-mix(in srgb, var(--color-electric-violet) 6%, transparent); }
    .focus  .chip-opt.selected { border-color: var(--color-vital-emerald, #10b981); background: color-mix(in srgb, var(--color-vital-emerald) 6%, transparent); }
    .energy .chip-opt.selected { border-color: var(--color-energetic-amber, #f59e0b); background: color-mix(in srgb, var(--color-energetic-amber) 6%, transparent); }
    .sleep  .chip-opt.selected { border-color: var(--color-sky-azure, #0ea5e9); background: color-mix(in srgb, var(--color-sky-azure) 6%, transparent); }

    .mood   .chip-opt.selected .chip-dot { background: var(--color-electric-violet, #8b5cf6); }
    .focus  .chip-opt.selected .chip-dot { background: var(--color-vital-emerald, #10b981); }
    .energy .chip-opt.selected .chip-dot { background: var(--color-energetic-amber, #f59e0b); }
    .sleep  .chip-opt.selected .chip-dot { background: var(--color-sky-azure, #0ea5e9); }

    .mood   .chip-opt.selected .chip-label { color: var(--color-electric-violet, #8b5cf6); }
    .focus  .chip-opt.selected .chip-label { color: var(--color-vital-emerald, #10b981); }
    .energy .chip-opt.selected .chip-label { color: var(--color-energetic-amber, #f59e0b); }
    .sleep  .chip-opt.selected .chip-label { color: var(--color-sky-azure, #0ea5e9); }

    .note textarea {
      width: 100%;
      min-height: 5.5rem;
      max-width: 100%;
      resize: vertical;
      border-radius: 0.5rem;
      border: 1px solid #cbd5e1;
      padding: 0.625rem 0.75rem;
      box-sizing: border-box;
      font-size: 0.875rem;
      font-family: inherit;
      color: var(--color-midnight-slate, #1e293b);
      background: #fafafa;
    }

    .note textarea:focus {
      outline: 2px solid color-mix(in srgb, var(--color-vital-emerald) 20%, transparent);
      border-color: var(--color-vital-emerald, #10b981);
    }

    .char-count {
      margin: 0;
      color: var(--color-text-muted, #64748b);
      font-size: 0.75rem;
      text-align: right;
    }

    .status {
      margin: 0.5rem 0;
      color: var(--color-text-muted, #64748b);
      font-size: 0.8125rem;
      line-height: 1.4;
    }

    .error {
      margin: 0.5rem 0 0;
      color: #b91c1c;
      font-size: 0.8125rem;
      font-weight: 600;
    }

    .action-bar {
      position: fixed;
      bottom: calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px));
      left: 0;
      right: 0;
      max-width: 28rem;
      margin: 0 auto;
      padding: 0.75rem 1rem 1rem;
      box-sizing: border-box;
      background: var(--color-ghost-white-canvas, #fcfcfd);
      border-top: 1px solid var(--color-border, #e2e8f0);
      display: grid;
      gap: 0.5rem;
      z-index: 10;
    }

    .save-button {
      min-height: 52px;
      width: 100%;
      border: none;
      border-radius: 999px;
      background: var(--color-vital-emerald, #10b981);
      color: #fff;
      font-size: 0.9375rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 8px 20px -8px color-mix(in srgb, var(--color-vital-emerald) 50%, transparent);
    }

    .cancel-button {
      min-height: 44px;
      width: 100%;
      border: none;
      background: transparent;
      color: var(--color-text-muted, #64748b);
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
  readonly isBackfill = this.logLocalDate() !== formatLocalDate(new Date());
  readonly dateContextLabel = computed(() => this.formatDateContextLabel(this.logLocalDate()));
  readonly moodScore = signal<number | null>(null);
  readonly focusScore = signal<number | null>(null);
  readonly energyScore = signal<number | null>(null);
  readonly sleepScore = signal<number | null>(null);
  readonly journalNote = signal('');
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isDirty = signal(false);
  readonly seededFromExisting = signal(false);

  readonly moodLabel   = computed(() => MOOD_BUCKETS.find(b => b.score === this.moodScore())?.label ?? null);
  readonly focusLabel  = computed(() => FOCUS_BUCKETS.find(b => b.score === this.focusScore())?.label ?? null);
  readonly energyLabel = computed(() => ENERGY_BUCKETS.find(b => b.score === this.energyScore())?.label ?? null);
  readonly sleepLabel  = computed(() => SLEEP_BUCKETS.find(b => b.score === this.sleepScore())?.label ?? null);

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

    if (this.moodScore() === null && this.focusScore() === null && this.energyScore() === null && this.sleepScore() === null) {
      this.errorMessage.set('Select at least one dimension to save');
      return;
    }

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
    const today = formatLocalDate(new Date());
    const param = this.route.snapshot.queryParamMap.get('date');
    if (!param || !/^\d{4}-\d{2}-\d{2}$/.test(param)) {
      return today;
    }
    const parsed = new Date(`${param}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? today : param;
  }

  private formatDateContextLabel(logLocalDate: string): string | null {
    const today = formatLocalDate(new Date());
    if (logLocalDate === today) return null;
    const parsed = new Date(`${logLocalDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    const weekday = parsed.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `Reflecting on ${weekday}, ${monthDay}`;
  }

}
