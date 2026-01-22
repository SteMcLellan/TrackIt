import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ParticipantService } from '../../services/participant.service';
import { Participant } from '../../models/participant';
import { environment } from '../../../../environments/environment';
import {
  HomeIconComponent,
  MedicationsIconComponent,
  IncidentsIconComponent,
  ParticipantsIconComponent
} from '../icons';

@Component({
  selector: 'app-top-sheet-menu',
  imports: [
    RouterLink,
    HomeIconComponent,
    MedicationsIconComponent,
    IncidentsIconComponent,
    ParticipantsIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isAuthenticated() && !hideOnAuthPage()) {
      <div
        class="sheet-backdrop"
        [class.open]="isOpen()"
        (click)="closeMenu()"
        aria-hidden="true"
      ></div>

      <section
        id="app-bottom-sheet"
        class="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        [class.open]="isOpen()"
        (keydown.escape)="closeMenu()"
        tabindex="-1"
      >
        <div class="drag-handle" aria-hidden="true">
          <div class="drag-bar"></div>
        </div>

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
          <div class="nav-grid">
            <a class="nav-link" routerLink="/home" (click)="closeMenu()">
              <app-icon-home class="nav-icon" />
              <span>Home</span>
            </a>
            <a class="nav-link" routerLink="/medications" (click)="closeMenu()">
              <app-icon-medications class="nav-icon" />
              <span>Medications</span>
            </a>
            <a class="nav-link" routerLink="/incidents" (click)="closeMenu()">
              <app-icon-incidents class="nav-icon" />
              <span>Incidents</span>
            </a>
            <a class="nav-link" routerLink="/participants" (click)="closeMenu()">
              <app-icon-participants class="nav-icon" />
              <span>Participants</span>
            </a>
          </div>
        </div>
      </section>
    }
  `,
  styles: [`
    .sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.4);
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--transition-normal, 200ms ease);
      z-index: 80;
    }

    .sheet-backdrop.open {
      opacity: 1;
      pointer-events: auto;
    }

    .bottom-sheet {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #fff;
      border-top-left-radius: var(--radius-3, 0.75rem);
      border-top-right-radius: var(--radius-3, 0.75rem);
      box-shadow: 0 -4px 24px rgba(15, 23, 42, 0.12);
      transform: translateY(100%);
      transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1);
      z-index: 90;
      padding: 0 var(--space-5, 1.5rem) var(--space-5, 1.5rem);
      padding-bottom: calc(var(--space-5, 1.5rem) + env(safe-area-inset-bottom, 0px));
      display: grid;
      gap: var(--space-4, 1rem);
      max-height: 70vh;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .bottom-sheet.open {
      transform: translateY(0);
    }

    .drag-handle {
      display: flex;
      justify-content: center;
      padding: var(--space-3, 0.75rem) 0;
      cursor: grab;
    }

    .drag-bar {
      width: 36px;
      height: 4px;
      background: #cbd5e1;
      border-radius: var(--radius-full, 999px);
    }

    .sheet-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3, 0.75rem);
    }

    .sheet-title {
      font-weight: 700;
      font-size: var(--font-size-lg, 1.125rem);
      color: var(--color-primary, #0c4a6e);
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
      font-size: var(--font-size-xs, 0.75rem);
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

    .nav-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-3, 0.75rem);
    }

    .nav-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2, 0.5rem);
      padding: var(--space-4, 1rem);
      border-radius: var(--radius-2, 0.5rem);
      border: 1px solid var(--color-border, #e2e8f0);
      text-decoration: none;
      color: #0f172a;
      font-weight: 600;
      background: #fff;
      transition: background var(--transition-fast, 120ms ease), border-color var(--transition-fast, 120ms ease);
    }

    .nav-link:active {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .nav-icon {
      font-size: 24px;
      color: var(--color-primary, #0c4a6e);
    }

    .section-link {
      border: none;
      background: none;
      padding: 0;
      color: var(--color-primary, #0c4a6e);
      font-weight: 600;
      text-decoration: none;
      font-size: var(--font-size-sm, 0.8125rem);
      cursor: pointer;
    }

    @media (min-width: 480px) {
      .nav-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }
  `]
})
export class TopSheetMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly participants = inject(ParticipantService);

  readonly isOpenExternal = input(false);
  readonly closed = output<void>();

  readonly isAuthenticated = this.auth.isAuthenticated;
  private readonly _isOpen = signal(false);

  readonly isOpen = computed(() => this._isOpen() || this.isOpenExternal());

  constructor() {
    effect(() => {
      if (this.isOpenExternal()) {
        this._isOpen.set(true);
      }
    });
  }

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
    this._isOpen.update((value) => !value);
  }

  closeMenu() {
    this._isOpen.set(false);
    this.closed.emit();
  }

  logout() {
    this.closeMenu();
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
