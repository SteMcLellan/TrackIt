import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../services/auth.service';

/**
 * Minimal top header bar showing app branding.
 * Hidden on login page.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isAuthenticated() && !hideOnAuthPage()) {
      <header class="page-header">
        <div class="brand">
          <svg
            class="logo"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M7.2 12.6 L10.5 15.9 L16.9 8.6"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle cx="16.8" cy="14.8" r="1.1" fill="currentColor" />
            <circle cx="18.6" cy="13.1" r="0.9" fill="currentColor" />
          </svg>
          <span class="brand-name">TrackIt</span>
        </div>
      </header>
    }
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-3, 0.75rem) var(--container-padding, var(--space-3, 0.75rem));
      background: #fff;
      border-bottom: 1px solid var(--color-border, #e2e8f0);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: var(--space-2, 0.5rem);
      color: var(--color-primary, #0c4a6e);
    }

    .logo {
      width: 24px;
      height: 24px;
    }

    .brand-name {
      font-weight: 700;
      font-size: var(--font-size-base, 0.9375rem);
      letter-spacing: -0.01em;
    }
  `]
})
export class PageHeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.auth.isAuthenticated;

  private readonly navigation = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  readonly hideOnAuthPage = computed(() => (this.navigation() || '').startsWith('/login'));
}
