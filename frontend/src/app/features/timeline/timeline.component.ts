import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { ParticipantService } from '../../shared/services/participant.service';
import { TimelineService } from '../../shared/services/timeline.service';
import { TimelineEvent, TimelineSourceType } from '../../shared/models/timeline-event';
import { ReflectionChip, ReflectionFacet, resolveReflectionChip } from '../../shared/utils/reflection-labels';

type TimelineSection = {
  logLocalDate: string;
  label: string;
  items: TimelineEvent[];
};

const DAYS_PER_REQUEST = 7;
const MAX_EMPTY_AUTOLOAD_ATTEMPTS = 365;
const FEED_SOURCE_TYPES: TimelineSourceType[] = [
  'incident',
  'medication_log',
  'medication',
  'daily_reflection'
];

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/a166f2fb385e4f7484f507dc2a886165
 * @stitch-screen-title TrackIt Timeline Feed
 * @stitch-status converted
 * @stitch-last-sync 2026-02-14
 */
@Component({
  selector: 'app-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="timeline-page">
      <header class="page-head">
        <h1>Timeline</h1>
        <p>All Activity in one place</p>
      </header>

      @if (!activeParticipantId()) {
        <p class="status error" role="alert">Select a participant to view timeline events.</p>
      } @else if (isInitialLoading()) {
        <div class="status loading">Loading timeline feed...</div>
      } @else if (loadError() && events().length === 0) {
        <p class="status error" role="alert">{{ loadError() }}</p>
      } @else if (sections().length === 0) {
        <p class="status muted">No timeline events found.</p>
      } @else {
        <div class="timeline-feed" role="feed" aria-label="Timeline feed">
          @for (section of sections(); track section.logLocalDate) {
            <div class="day-label">{{ section.label }}</div>
            <div class="day-group">
              <div class="timeline-line" aria-hidden="true"></div>
              @for (event of section.items; track event.id) {
                <article class="entry" role="article">
                  <div
                    class="entry-node"
                    [class.entry-node-incident]="event.sourceType === 'incident'"
                    [class.entry-node-medication-log]="event.sourceType === 'medication_log'"
                    [class.entry-node-medication]="event.sourceType === 'medication'"
                    [class.entry-node-daily-reflection]="event.sourceType === 'daily_reflection'"
                  >
                    <span class="material-symbols-outlined">{{ sourceIcon(event.sourceType) }}</span>
                  </div>
                  <div class="entry-card">
                    <div class="entry-head">
                      <h2>{{ event.summary.title }}</h2>
                      <span class="entry-time">{{ formatEventTime(event) }}</span>
                    </div>

                    @if (event.summary.subtitle) {
                      <p class="entry-copy">{{ event.summary.subtitle }}</p>
                    }

                    @if (event.sourceType === 'incident' && incidentChipLabel(event); as chipLabel) {
                      <div class="chip-row">
                        <span class="chip chip-violet">{{ chipLabel }}</span>
                      </div>
                    }

                    @if (event.sourceType === 'daily_reflection' && reflectionChips(event).length > 0) {
                      <div class="chip-row">
                        @for (chip of reflectionChips(event); track chip.label) {
                          <span class="chip" [class]="chip.colorClass">{{ chip.label }}</span>
                        }
                      </div>
                    }
                  </div>
                </article>
              }
            </div>
          }

          <div #loadMoreSentinel class="load-more-sentinel" aria-hidden="true"></div>

          @if (isLoadingMore()) {
            <div class="spinner-wrap" aria-label="Loading more timeline events">
              <div class="spinner"></div>
            </div>
          } @else if (loadError()) {
            <p class="status error end-label" role="alert">{{ loadError() }}</p>
          } @else if (!canLoadMore() && !loadError()) {
            <p class="status muted end-label">You&apos;re all caught up.</p>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-width: 100%;
      background: var(--color-ghost-white-canvas, #fcfcfd);
    }

    .timeline-page {
      width: 100%;
      max-width: 100%;
      padding: 1.5rem 1.5rem 1rem;
      box-sizing: border-box;
      overflow-x: hidden;
      background: var(--color-ghost-white-canvas, #fcfcfd);
    }

    .page-head {
      display: grid;
      gap: 0.25rem;
      padding-bottom: 0.5rem;
    }

    h1 {
      margin: 0;
      color: var(--color-midnight-slate, #1e293b);
      font-size: 1.55rem;
      line-height: 1.2;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .page-head p {
      margin: 0;
      color: var(--color-text-muted, #64748b);
      font-size: var(--font-size-sm, 0.8125rem);
      font-weight: 500;
    }

    .status {
      margin: 0.75rem 0 0;
      font-size: var(--font-size-sm, 0.8125rem);
      line-height: 1.45;
    }

    .status.error {
      color: #b91c1c;
      font-weight: 600;
    }

    .status.loading,
    .status.muted {
      color: var(--color-text-muted, #64748b);
    }

    .timeline-feed {
      display: grid;
      gap: 0.75rem;
      padding-top: 0.35rem;
    }

    .day-label {
      position: sticky;
      top: 0;
      z-index: 10;
      margin: 0;
      padding: 0.85rem 0 0.3rem;
      background: rgba(252, 252, 253, 0.9);
      backdrop-filter: blur(4px);
      color: var(--color-vital-emerald, #10b981);
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .day-group {
      position: relative;
      display: grid;
      gap: 1rem;
      padding-left: 2rem;
    }

    .timeline-line {
      position: absolute;
      left: 0.72rem;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--color-border, #e2e8f0);
    }

    .entry {
      position: relative;
    }

    .entry-node {
      position: absolute;
      left: -2rem;
      top: 0.6rem;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 999px;
      border: 4px solid var(--color-ghost-white-canvas, #fcfcfd);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
    }

    .entry-node .material-symbols-outlined {
      font-size: 12px;
      line-height: 1;
    }

    .entry-node-incident {
      background: rgba(139, 92, 246, 0.16);
      color: var(--color-electric-violet, #8b5cf6);
    }

    .entry-node-medication-log {
      background: rgba(16, 185, 129, 0.14);
      color: var(--color-vital-emerald, #10b981);
    }

    .entry-node-medication {
      background: rgba(245, 158, 11, 0.14);
      color: var(--color-energetic-amber, #f59e0b);
    }

    .entry-node-daily-reflection {
      background: rgba(14, 165, 233, 0.14);
      color: var(--color-sky-azure, #0ea5e9);
    }

    .entry-card {
      background: #fff;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: 0.75rem;
      padding: 0.85rem;
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.04));
    }

    .entry-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
      margin-bottom: 0.4rem;
    }

    .entry-head h2 {
      margin: 0;
      font-size: 0.88rem;
      line-height: 1.25;
      font-weight: 700;
      color: var(--color-midnight-slate, #1e293b);
    }

    .entry-time {
      color: var(--color-text-muted, #64748b);
      font-size: 0.62rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .entry-copy {
      margin: 0;
      color: #475569;
      font-size: 0.8rem;
      line-height: 1.45;
    }

    .chip-row {
      margin-top: 0.45rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .chip {
      border-radius: 0.3rem;
      padding: 0.1rem 0.42rem;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.01em;
    }

    .chip-violet {
      background: rgba(139, 92, 246, 0.14);
      color: var(--color-electric-violet, #8b5cf6);
      text-transform: uppercase;
    }

    .chip-sky {
      background: rgba(14, 165, 233, 0.14);
      color: var(--color-sky-azure, #0ea5e9);
    }

    .chip-emerald {
      background: rgba(16, 185, 129, 0.14);
      color: var(--color-vital-emerald, #10b981);
    }

    .chip-amber {
      background: rgba(245, 158, 11, 0.14);
      color: var(--color-energetic-amber, #f59e0b);
    }

    .load-more-sentinel {
      width: 100%;
      height: 1px;
      margin-top: -0.2rem;
    }

    .spinner-wrap {
      display: flex;
      justify-content: center;
      padding: 0.8rem 0 0.2rem;
    }

    .spinner {
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 999px;
      border: 2px solid var(--color-vital-emerald, #10b981);
      border-top-color: transparent;
      animation: spin 900ms linear infinite;
    }

    .end-label {
      padding: 0.5rem 0 0.2rem;
      text-align: center;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class TimelineComponent implements AfterViewInit, OnDestroy {
  private readonly participants = inject(ParticipantService);
  private readonly timeline = inject(TimelineService);

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly events = signal<TimelineEvent[]>([]);
  readonly nextCursorDate = signal<string | null>(null);
  readonly isInitialLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly canLoadMore = computed(() => this.nextCursorDate() !== null && !this.isInitialLoading() && !this.isLoadingMore());
  readonly sections = computed<TimelineSection[]>(() => this.groupByLocalDate(this.events()));

  private requestVersion = 0;
  private anchorDate = '';
  private emptyAutoloadAttempts = 0;
  private loadMoreObserver: IntersectionObserver | null = null;
  private loadMoreSentinelRef: ElementRef<HTMLDivElement> | null = null;

  @ViewChild('loadMoreSentinel')
  set loadMoreSentinel(value: ElementRef<HTMLDivElement> | undefined) {
    this.loadMoreSentinelRef = value ?? null;
    this.observeLoadMoreSentinel();
  }

  constructor() {
    effect(
      () => {
        const participantId = this.activeParticipantId();
        this.resetFeedState();
        this.requestVersion += 1;
        if (!participantId) {
          return;
        }
        this.loadInitialPage(participantId, this.requestVersion);
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        const participantId = this.activeParticipantId();
        const hasEvents = this.events().length > 0;
        const nextCursorDate = this.nextCursorDate();
        const isLoading = this.isInitialLoading() || this.isLoadingMore();
        const loadError = this.loadError();

        if (!participantId || hasEvents || isLoading || loadError || !nextCursorDate) {
          return;
        }

        if (this.emptyAutoloadAttempts >= MAX_EMPTY_AUTOLOAD_ATTEMPTS) {
          this.loadError.set('Unable to find timeline events for this participant.');
          return;
        }

        this.emptyAutoloadAttempts += 1;
        this.loadNextPage();
      },
      { allowSignalWrites: true }
    );
  }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.loadMoreObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        this.loadNextPage();
      },
      { root: null, rootMargin: '0px 0px 180px 0px', threshold: 0 }
    );
    this.observeLoadMoreSentinel();
  }

  ngOnDestroy(): void {
    this.loadMoreObserver?.disconnect();
  }

  sourceIcon(sourceType: TimelineSourceType): string {
    if (sourceType === 'incident') return 'priority_high';
    if (sourceType === 'medication_log') return 'medical_services';
    if (sourceType === 'daily_reflection') return 'edit_note';
    return 'medication';
  }

  incidentChipLabel(event: TimelineEvent): string | null {
    const functionValue = this.extractTagValue(event, 'function:');
    if (functionValue) {
      return functionValue.replace(/_/g, ' ');
    }
    return event.summary.function ? event.summary.function.replace(/_/g, ' ') : null;
  }

  reflectionChips(event: TimelineEvent): ReflectionChip[] {
    const tags = event.tags ?? [];
    const chips: ReflectionChip[] = [];
    const facets: Array<{ prefix: string; facet: ReflectionFacet }> = [
      { prefix: 'mood_band:', facet: 'mood' },
      { prefix: 'focus_band:', facet: 'focus' },
      { prefix: 'energy_band:', facet: 'energy' },
      { prefix: 'sleep_band:', facet: 'sleep' }
    ];

    for (const { prefix, facet } of facets) {
      const value = tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
      if (!value) {
        continue;
      }
      chips.push(resolveReflectionChip(facet, value));
    }
    return chips;
  }

  formatEventTime(event: TimelineEvent): string {
    if (event.logLocalTime) {
      return this.formatTimeLabel(event.logLocalTime);
    }

    const parsed = new Date(event.eventAtUtc);
    if (Number.isNaN(parsed.getTime())) {
      return 'Time n/a';
    }
    const hh = String(parsed.getHours()).padStart(2, '0');
    const mm = String(parsed.getMinutes()).padStart(2, '0');
    return this.formatTimeLabel(`${hh}:${mm}`);
  }

  private loadInitialPage(participantId: string, requestVersion: number): void {
    this.anchorDate = this.todayDateOnly();

    this.isInitialLoading.set(true);
    this.timeline.listTimeline(participantId, {
      date: this.anchorDate,
      days: DAYS_PER_REQUEST,
      types: FEED_SOURCE_TYPES
    }).subscribe({
      next: (response) => {
        if (requestVersion !== this.requestVersion) {
          return;
        }
        this.events.set(response.items ?? []);
        this.nextCursorDate.set(response.nextCursorDate ?? null);
        this.loadError.set(null);
        this.isInitialLoading.set(false);
      },
      error: () => {
        if (requestVersion !== this.requestVersion) {
          return;
        }
        this.loadError.set('Unable to load timeline feed right now.');
        this.isInitialLoading.set(false);
      }
    });
  }

  private loadNextPage(): void {
    if (!this.canLoadMore()) {
      return;
    }

    const participantId = this.activeParticipantId();
    const nextCursorDate = this.nextCursorDate();
    if (!participantId || !nextCursorDate) {
      return;
    }

    const requestVersion = this.requestVersion;
    this.isLoadingMore.set(true);
    this.timeline.listTimeline(participantId, {
      date: this.anchorDate,
      cursorDate: nextCursorDate,
      days: DAYS_PER_REQUEST,
      types: FEED_SOURCE_TYPES
    }).subscribe({
      next: (response) => {
        if (requestVersion !== this.requestVersion) {
          return;
        }
        this.events.update((current) => this.mergeById(current, response.items ?? []));
        this.nextCursorDate.set(response.nextCursorDate ?? null);
        this.loadError.set(null);
        this.isLoadingMore.set(false);
      },
      error: () => {
        if (requestVersion !== this.requestVersion) {
          return;
        }
        this.loadError.set('Unable to load more timeline events.');
        this.isLoadingMore.set(false);
      }
    });
  }

  private observeLoadMoreSentinel(): void {
    if (!this.loadMoreObserver || !this.loadMoreSentinelRef) {
      return;
    }
    this.loadMoreObserver.disconnect();
    this.loadMoreObserver.observe(this.loadMoreSentinelRef.nativeElement);
  }

  private resetFeedState(): void {
    this.events.set([]);
    this.nextCursorDate.set(null);
    this.loadError.set(null);
    this.isInitialLoading.set(false);
    this.isLoadingMore.set(false);
    this.anchorDate = '';
    this.emptyAutoloadAttempts = 0;
  }

  private mergeById(current: TimelineEvent[], incoming: TimelineEvent[]): TimelineEvent[] {
    if (incoming.length === 0) {
      return current;
    }

    const existingIds = new Set(current.map((item) => item.id));
    const appended: TimelineEvent[] = [...current];
    for (const item of incoming) {
      if (!existingIds.has(item.id)) {
        appended.push(item);
        existingIds.add(item.id);
      }
    }
    return appended;
  }

  private groupByLocalDate(items: TimelineEvent[]): TimelineSection[] {
    if (items.length === 0) {
      return [];
    }

    const grouped = new Map<string, TimelineEvent[]>();
    for (const item of items) {
      const key = item.logLocalDate;
      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        grouped.set(key, [item]);
      }
    }

    return Array.from(grouped.entries()).map(([logLocalDate, groupItems]) => ({
      logLocalDate,
      label: this.formatDayLabel(logLocalDate),
      items: groupItems
    }));
  }

  private formatDayLabel(logLocalDate: string): string {
    const date = this.parseDateOnly(logLocalDate);
    if (!date) {
      return logLocalDate;
    }

    const today = this.localDateOnly(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const localDate = this.localDateOnly(date);
    const monthDay = this.formatMonthDay(localDate);
    if (localDate.getTime() === today.getTime()) {
      return `Today, ${monthDay}`;
    }
    if (localDate.getTime() === yesterday.getTime()) {
      return `Yesterday, ${monthDay}`;
    }

    const weekday = localDate.toLocaleDateString('en-US', { weekday: 'long' });
    return `${weekday}, ${monthDay}`;
  }

  private parseDateOnly(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private localDateOnly(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private todayDateOnly(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatMonthDay(value: Date): string {
    return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private formatTimeLabel(value: string): string {
    const [hourRaw, minuteRaw] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return value;
    }
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
  }

  private extractTagValue(event: TimelineEvent, prefix: string): string | null {
    const match = (event.tags ?? []).find((tag) => tag.startsWith(prefix));
    return match ? match.slice(prefix.length) : null;
  }
}
