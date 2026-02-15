import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopBarComponent } from './top-bar.component';
import { ShellBottomNavComponent } from './bottom-nav.component';

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
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--color-ghost-white-canvas, #fcfcfd);
    }

    .shell {
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      background: var(--color-ghost-white-canvas, #fcfcfd);
    }

    main {
      flex: 1;
      min-height: 0;
      padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
      background: var(--color-ghost-white-canvas, #fcfcfd);
    }
  `]
})
export class ShellComponent {}
