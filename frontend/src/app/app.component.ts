import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root application host for route rendering.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet></router-outlet>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--color-ghost-white-canvas, #fcfcfd);
      font-family: var(--font-family, 'Inter', system-ui, -apple-system, sans-serif);
    }
  `]
})
export class AppComponent {}
