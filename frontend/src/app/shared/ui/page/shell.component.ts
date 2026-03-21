import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopBarComponent } from './top-bar.component';
import { ShellBottomNavComponent } from './bottom-nav.component';
import { ClerkService } from '../../services/clerk.service';

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/efcaceb73e4746e2a655f9d447f9f420
 * @stitch-screen-title Parental Insight Dashboard
 * @stitch-status converted
 * @stitch-last-sync 2026-02-11
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, TopBarComponent, ShellBottomNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      @if (authError()) {
        <section class="auth-warning" role="alert" aria-live="polite">
          <p class="auth-warning-title">Authentication setup issue</p>
          <p class="auth-warning-copy">{{ authError() }}</p>
        </section>
      }
      <app-top-bar />
      <main>
        <router-outlet />
      </main>
      <app-shell-bottom-nav />
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
      background: var(--color-ghost-white-canvas, #fcfcfd);
    }

    .shell {
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--color-ghost-white-canvas, #fcfcfd);
    }

    .auth-warning {
      margin: 0;
      padding: 0.875rem 1rem;
      background: #fef2f2;
      border-bottom: 1px solid #fecaca;
      color: #991b1b;
    }

    .auth-warning-title,
    .auth-warning-copy {
      margin: 0;
    }

    .auth-warning-title {
      font-size: 0.8125rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      text-transform: uppercase;
    }

    .auth-warning-copy {
      margin-top: 0.25rem;
      font-size: 0.875rem;
      line-height: 1.45;
    }

    main {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
      background: var(--color-ghost-white-canvas, #fcfcfd);
    }
  `]
})
export class ShellComponent {
  readonly authError = inject(ClerkService).error;
}
