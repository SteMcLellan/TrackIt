import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/efcaceb73e4746e2a655f9d447f9f420
 * @stitch-screen-title Parental Insight Dashboard
 * @stitch-status converted
 * @stitch-last-sync 2026-02-11
 */
@Component({
  selector: 'app-shell-bottom-nav',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="bottom-nav" aria-label="Primary">
      @for (item of navItems; track item.route) {
        <a
          class="nav-item"
          [routerLink]="item.route"
          [attr.aria-current]="isActive(item.route) ? 'page' : null"
          [class.active]="isActive(item.route)"
        >
          <span class="material-symbols-outlined" [class.fill-1]="isActive(item.route)">
            {{ item.icon }}
          </span>
          <span class="label">{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
  styles: [`
    .bottom-nav {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 50;
      max-width: 28rem;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 1.25rem calc(0.375rem + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid #f1f5f9;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
    }

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      color: #94a3b8;
      text-decoration: none;
      transition: color var(--transition-fast, 120ms ease);
      min-width: 44px;
      min-height: 40px;
      justify-content: center;
    }

    .nav-item.active {
      color: #8b5cf6;
    }

    .material-symbols-outlined {
      font-size: 26px;
    }

    .label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: -0.04em;
      line-height: 1;
    }

    @media (max-width: 480px) {
      .bottom-nav {
        padding: 0.4375rem 1rem calc(0.25rem + env(safe-area-inset-bottom, 0px));
      }

      .material-symbols-outlined {
        font-size: 24px;
      }

      .label {
        font-size: 8px;
      }
    }
  `]
})
export class ShellBottomNavComponent {
  private readonly router = inject(Router);

  readonly navItems = [
    { label: 'Insights', icon: 'insights', route: '/insights' },
    { label: 'Timeline', icon: 'calendar_today', route: '/timeline' },
    { label: 'Profile', icon: 'settings', route: '/profile' }
  ] as const;

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  readonly normalizedUrl = computed(() => (this.currentUrl() || '').split('?')[0].split('#')[0]);

  isActive(route: string): boolean {
    const current = this.normalizedUrl();
    return current === route || current.startsWith(`${route}/`);
  }
}
