import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type LogStatus = 'taken' | 'not_taken' | null;

@Component({
  selector: 'app-medication-dots-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showRangeLabels()) {
      <div class="labels" aria-hidden="true">
        <span>{{ leftLabel() }}</span>
        <span>{{ rightLabel() }}</span>
      </div>
    }
    <div class="strip" role="list">
      @for (day of dates(); track day) {
        <span
          class="day"
          [class.taken]="status(day) === 'taken'"
          [class.not-taken]="status(day) === 'not_taken'"
          [class.not-logged]="!status(day)"
          [class.inactive]="!isActiveOn(day)"
          [attr.aria-label]="day + ': ' + ariaStatusLabel(day)"
          role="listitem"
        ></span>
      }
    </div>
  `,
  styles: [
    `
      .labels {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
        color: var(--color-text-muted, #64748b);
        font-size: 0.85rem;
        font-weight: 600;
      }
      .strip {
        display: grid;
        grid-auto-flow: column;
        gap: 0.35rem;
        align-items: center;
        justify-content: start;
      }
      .day {
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 999px;
        background: #e2e8f0;
        border: 1px solid transparent;
      }
      .day.taken {
        background: #22c55e;
        border-color: #16a34a;
      }
      .day.not-taken {
        background: #fff;
        border-color: #ef4444;
        position: relative;
      }
      .day.not-taken::after {
        content: '';
        position: absolute;
        width: 120%;
        height: 2px;
        background: #ef4444;
        top: 50%;
        left: -10%;
        transform: rotate(-35deg);
      }
      .day.not-logged {
        background: #f1f5f9;
      }
      .day.inactive {
        background: transparent;
        border-color: #e2e8f0;
        opacity: 0.5;
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
