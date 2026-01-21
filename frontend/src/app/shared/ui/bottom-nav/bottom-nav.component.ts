import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isAuthenticated() && !hideOnAuthPage()) {
      <nav class="bottom-nav" aria-label="Main navigation">
        <a
          class="nav-item"
          routerLink="/home"
          [class.active]="isActive('/home')"
          aria-label="Home"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span class="nav-label">Home</span>
        </a>

        <a
          class="nav-item"
          routerLink="/medications"
          [class.active]="isActive('/medications')"
          aria-label="Medications"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 1 1 7-7l7 7a4.95 4.95 0 0 1-7 7z"/>
            <path d="M8.5 8.5l7 7"/>
          </svg>
          <span class="nav-label">Meds</span>
        </a>

        <button
          class="nav-item fab"
          type="button"
          aria-label="Log incident"
          (click)="onLogIncident()"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <a
          class="nav-item"
          routerLink="/incidents"
          [class.active]="isActive('/incidents')"
          aria-label="Incidents"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span class="nav-label">Incidents</span>
        </a>

        <button
          class="nav-item"
          type="button"
          [class.active]="false"
          aria-label="More options"
          (click)="menuRequested.emit()"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          <span class="nav-label">More</span>
        </button>
      </nav>
    }
  `,
  styles: [`
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 50;
      display: flex;
      justify-content: space-around;
      align-items: flex-end;
      height: var(--bottom-nav-height, 56px);
      padding-bottom: env(safe-area-inset-bottom, 0);
      background: #fff;
      border-top: 1px solid #e2e8f0;
      box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
    }

    .nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      height: 100%;
      padding: 6px 0;
      background: none;
      border: none;
      color: #64748b;
      text-decoration: none;
      cursor: pointer;
      transition: color var(--transition-fast, 120ms) ease;
      -webkit-tap-highlight-color: transparent;
    }

    .nav-item:active {
      transform: scale(0.95);
    }

    .nav-item.active {
      color: var(--color-primary, #0c4a6e);
    }

    .nav-item.fab {
      flex: 0 0 auto;
      width: 52px;
      height: 52px;
      margin-bottom: 12px;
      padding: 0;
      border-radius: 50%;
      background: var(--color-primary, #0c4a6e);
      color: #fff;
      box-shadow: var(--shadow-md, 0 2px 8px rgba(0, 0, 0, 0.06));
    }

    .nav-item.fab:active {
      transform: scale(0.92);
    }

    .nav-icon {
      width: 22px;
      height: 22px;
    }

    .nav-item.fab .nav-icon {
      width: 24px;
      height: 24px;
    }

    .nav-label {
      font-size: var(--font-size-sm, 13px);
      font-weight: 500;
      line-height: 1;
    }
  `]
})
export class BottomNavComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly menuRequested = output<void>();
  readonly isAuthenticated = this.auth.isAuthenticated;

  private readonly navigation = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  readonly hideOnAuthPage = computed(() => (this.navigation() || '').startsWith('/login'));

  isActive(path: string): boolean {
    const current = this.navigation() || '';
    if (path === '/home') {
      return current === '/home' || current === '/';
    }
    return current.startsWith(path);
  }

  onLogIncident() {
    this.router.navigate(['/incidents/new']);
  }
}
