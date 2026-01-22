import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type LogStatus = 'taken' | 'not_taken' | null;

@Component({
  selector: 'app-medication-dots-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <div class="strip" [class.grid-30]="dates().length === 30" role="list">
        @for (day of dates(); track day; let isLast = $last) {
          <span
            class="dot"
            [class.taken]="status(day) === 'taken'"
            [class.skipped]="status(day) === 'not_taken'"
            [class.pending]="!status(day) && isActiveOn(day)"
            [class.inactive]="!isActiveOn(day)"
            [class.today]="isLast"
            [attr.aria-label]="day + ': ' + ariaStatusLabel(day)"
            role="listitem"
          ></span>
        }
      </div>
      @if (showRangeLabels()) {
        <div class="labels" aria-hidden="true">
          <span class="label-left">{{ leftLabel() }}</span>
          <span class="label-right">{{ rightLabel() }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        max-width: 100%;
      }
      .container {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        min-width: 0;
      }
      .strip {
        display: flex;
        gap: 3px;
        align-items: center;
        padding: 6px 8px;
        background: #f8fafc;
        border-radius: var(--radius-2, 0.5rem);
        max-width: 100%;
        overflow: hidden;
      }
      .strip.grid-30 {
        display: grid;
        grid-template-columns: repeat(15, max-content);
        grid-auto-flow: row;
        column-gap: 3px;
        row-gap: 6px;
        align-items: center;
      }
      .dot {
        width: 10px;
        height: 10px;
        min-width: 10px;
        border-radius: 3px;
        background: #e2e8f0;
        transition: transform var(--transition-fast, 120ms ease);
      }
      .dot.today {
        width: 12px;
        height: 12px;
        min-width: 12px;
      }
      .dot.taken {
        background: #86efac;
      }
      .dot.taken.today {
        background: #4ade80;
        box-shadow: 0 0 0 2px #f8fafc, 0 0 0 3px #4ade80;
      }
      .dot.skipped {
        background: #fcd34d;
      }
      .dot.skipped.today {
        background: #fbbf24;
        box-shadow: 0 0 0 2px #f8fafc, 0 0 0 3px #fbbf24;
      }
      .dot.pending {
        background: #cbd5e1;
      }
      .dot.pending.today {
        background: #94a3b8;
        box-shadow: 0 0 0 2px #f8fafc, 0 0 0 3px #94a3b8;
      }
      .dot.inactive {
        background: transparent;
        border: 1px dashed #e2e8f0;
      }
      .labels {
        display: flex;
        justify-content: space-between;
        padding: 0 2px;
      }
      .label-left,
      .label-right {
        font-size: 0.7rem;
        color: var(--color-text-muted, #94a3b8);
        font-weight: 500;
        letter-spacing: 0.01em;
      }
    `
  ]
})
export class MedicationDotsStripComponent {
  readonly dates = input.required<string[]>();
  readonly statusesByDate = input<Record<string, Exclude<LogStatus, null>>>({});
  readonly startDateUtc = input.required<string>();
  readonly endDateUtc = input<string | null>(null);
  readonly showRangeLabels = input(false);

  status(day: string): LogStatus {
    return this.statusesByDate()[day] ?? null;
  }

  isActiveOn(day: string): boolean {
    if (day < this.startDateUtc()) {
      return false;
    }
    const end = this.endDateUtc();
    if (end && day > end) {
      return false;
    }
    return true;
  }

  statusLabel(status: LogStatus) {
    if (status === 'taken') {
      return 'Taken';
    }
    if (status === 'not_taken') {
      return 'Not taken';
    }
    return 'Not logged';
  }

  ariaStatusLabel(day: string) {
    if (!this.isActiveOn(day)) {
      return 'Not active';
    }
    return this.statusLabel(this.status(day));
  }

  leftLabel(): string {
    const first = this.dates()[0];
    return first ? this.formatShortDate(first) : '';
  }

  rightLabel(): string {
    const last = this.dates()[this.dates().length - 1];
    if (!last) {
      return 'Today';
    }
    return last === this.todayLocalDate() ? 'Today' : this.formatShortDate(last);
  }

  private todayLocalDate(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatShortDate(value: string): string {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
  }
}
