import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/efcaceb73e4746e2a655f9d447f9f420
 * @stitch-screen-title Parental Insight Dashboard
 * @stitch-status converted
 * @stitch-last-sync 2026-02-11
 */
@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top-bar">
      <div class="brand-cluster" aria-label="TrackIt">
        <div class="logo-wrap" aria-hidden="true">
          <svg viewBox="0 0 22 20" focusable="false">
            <path d="M2 14C4 14 6 8 8 10C10 12 12 6 14 6" class="line-emerald" />
            <path d="M5 16C7 16 9 10 11 12C13 14 15 8 17 8" class="line-violet" />
            <path d="M8 18C10 18 12 12 14 14C16 16 18 10 20 10" class="line-amber" />
          </svg>
        </div>
        <span class="wordmark">TrackIt</span>
      </div>

      <div class="actions">
        <button
          type="button"
          class="icon-button notifications"
          aria-label="Notifications"
          (click)="notificationsClicked.emit()"
        >
          <span class="material-symbols-outlined">notifications</span>
        </button>

        <button
          type="button"
          class="icon-button account"
          aria-label="Account"
          (click)="goToProfile()"
        >
          <span class="material-symbols-outlined">account_circle</span>
        </button>
      </div>
    </header>
  `,
  styles: [`
    .top-bar {
      position: sticky;
      top: 0;
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1rem 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(12px);
    }

    .brand-cluster {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .logo-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
    }

    svg {
      width: 1.5rem;
      height: 1.5rem;
      fill: none;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .line-emerald {
      stroke: #10b981;
    }

    .line-violet {
      stroke: #8b5cf6;
    }

    .line-amber {
      stroke: #f59e0b;
    }

    .wordmark {
      color: #0f172a;
      font-size: 1.125rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .icon-button {
      width: 2.25rem;
      height: 2.25rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1px solid transparent;
      background: #fff;
      cursor: pointer;
      color: inherit;
    }

    .notifications {
      border-color: #f1f5f9;
      color: #94a3b8;
    }

    .account {
      border-color: #ede9fe;
      background: #f5f3ff;
      color: #8b5cf6;
    }

    .material-symbols-outlined {
      font-size: 1.25rem;
    }
  `]
})
export class TopBarComponent {
  private readonly router = inject(Router);

  readonly notificationsClicked = output<void>();

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }
}
