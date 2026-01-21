import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ParticipantService } from '../../services/participant.service';
import { Participant } from '../../models/participant';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-top-sheet-menu',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isAuthenticated() && !hideOnAuthPage()) {
      <header class="top-bar">
        <button
          class="logo-button"
          type="button"
          [attr.aria-expanded]="isOpen()"
          aria-controls="app-top-sheet"
          aria-label="Open menu"
          (click)="toggleMenu()"
        >
          <svg
            class="logo-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M7.2 12.6 L10.5 15.9 L16.9 8.6"
              fill="none"
              stroke="#ffffff"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle cx="16.8" cy="14.8" r="1.1" fill="#ffffff" />
            <circle cx="18.6" cy="13.1" r="0.9" fill="#ffffff" />
          </svg>
        </button>
      </header>

      <div class="sheet-backdrop" [class.open]="isOpen()" (click)="closeMenu()" aria-hidden="true"></div>

      <section
        id="app-top-sheet"
        class="top-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        [class.open]="isOpen()"
        (keydown.escape)="closeMenu()"
        tabindex="-1"
      >
        <div class="sheet-header">
          <span class="sheet-title">TrackIt</span>
        </div>

        <div class="sheet-section">
          <div class="section-header">
            <div class="section-label">Signed in</div>
            <button class="section-link" type="button" (click)="logout()">Logout</button>
          </div>
          <div class="section-value">{{ displayName() }}</div>
          @if (userEmail()) {
            <div class="section-sub">{{ userEmail() }}</div>
          }
        </div>

        <div class="sheet-section">
          <div class="section-header">
            <div class="section-label">Tracking</div>
            <a class="section-link" routerLink="/participants" (click)="closeMenu()">Switch</a>
          </div>
          @if (activeParticipant()) {
            <div class="section-value">
              {{ activeParticipant()!.displayName || 'Participant' }}
              <span class="section-sub">(Age {{ activeParticipant()!.ageYears }})</span>
            </div>
          } @else {
            <div class="section-value muted">No active participant selected</div>
          }
        </div>

        <div class="sheet-section">
          <div class="section-label">Navigate</div>
          <div class="button-group">
            <a class="menu-link" routerLink="/home" (click)="closeMenu()">Home</a>
            <a class="menu-link" routerLink="/medications" (click)="closeMenu()">Medications</a>
            <a class="menu-link" routerLink="/participants" (click)="closeMenu()">Participants</a>
          </div>
        </div>

      </section>
    }
  `,
  styles: [
    `
      .top-bar {
        position: sticky;
        top: 0;
        z-index: 20;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0;
        background: #0c4a6e;
        color: #f8fafc;
      }

      .logo-button {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0.15rem;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .logo-icon {
        width: 40px;
        height: 40px;
      }

      .logo-button:focus-visible {
        outline: 2px solid #e2e8f0;
        outline-offset: 2px;
      }

      .sheet-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.35);
        opacity: 0;
        pointer-events: none;
        transition: opacity 200ms ease;
        z-index: 30;
      }

      .sheet-backdrop.open {
        opacity: 1;
        pointer-events: auto;
      }

      .top-sheet {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #fff;
        border-bottom-left-radius: var(--radius-2, 0.5rem);
        border-bottom-right-radius: var(--radius-2, 0.5rem);
        box-shadow: 0 20px 30px rgba(15, 23, 42, 0.2);
        transform: translateY(-110%);
        transition: transform 220ms ease;
        z-index: 40;
        padding: var(--space-5, 1.5rem);
        display: grid;
        gap: var(--space-4, 1rem);
        max-height: 80vh;
        overflow-y: auto;
      }

      .top-sheet.open {
        transform: translateY(0);
      }

      .sheet-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-3, 0.75rem);
      }

      .sheet-title {
        font-weight: 700;
        font-size: 1.1rem;
        color: #0c4a6e;
      }

      .sheet-section {
        display: grid;
        gap: var(--space-2, 0.5rem);
      }

      .section-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-2, 0.5rem);
      }

      .section-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-muted, #64748b);
        font-weight: 600;
      }

      .section-value {
        font-weight: 600;
      }

      .section-sub {
        color: var(--color-text-muted, #64748b);
        font-weight: 500;
      }

      .muted {
        color: var(--color-text-muted, #64748b);
        font-weight: 500;
      }

      .menu-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
        border-radius: var(--radius-2, 0.5rem);
        border: 1px solid #cbd5f5;
        text-decoration: none;
        color: #0f172a;
        font-weight: 600;
        background: #fff;
      }

      .section-link {
        border: none;
        background: none;
        padding: 0;
        color: var(--color-primary, #0c4a6e);
        font-weight: 600;
        text-decoration: none;
        font-size: 0.85rem;
        cursor: pointer;
      }

    `
  ]
})
export class TopSheetMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly participants = inject(ParticipantService);

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly isOpen = signal(false);

  readonly displayName = computed(() => {
    const user = this.auth.appUser();
    return user.name || user.email || 'Signed in';
  });

  readonly userEmail = computed(() => this.auth.appUser().email || '');

  private readonly navigation = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  readonly hideOnAuthPage = computed(() => (this.navigation() || '').startsWith('/login'));

  readonly activeParticipantId = this.participants.activeParticipantId;
  readonly participantResource = httpResource<Participant>(() => ({
    url: `${environment.apiBaseUrl}/participants/${this.activeParticipantId() ?? ''}`,
    method: 'GET'
  }));

  readonly activeParticipant = computed(() => {
    if (!this.activeParticipantId()) {
      return null;
    }
    return this.participantResource.hasValue() ? this.participantResource.value() : null;
  });

  toggleMenu() {
    this.isOpen.update((value) => !value);
  }

  closeMenu() {
    this.isOpen.set(false);
  }

  logout() {
    this.closeMenu();
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
