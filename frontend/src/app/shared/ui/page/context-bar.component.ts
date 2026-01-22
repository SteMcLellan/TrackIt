import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { httpResource } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ParticipantService } from '../../services/participant.service';
import { Participant } from '../../models/participant';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-context-bar',
  imports: [NgOptimizedImage, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isAuthenticated() && !hideOnAuthPage()) {
      <section class="context-bar" aria-label="Current user context">
        @if (avatarUrl()) {
          <img
            class="avatar"
            [ngSrc]="avatarUrl()!"
            width="32"
            height="32"
            alt=""
          />
        } @else {
          <div class="avatar placeholder" aria-hidden="true"></div>
        }
        <div class="identity">
          <span class="label">Signed in</span>
          <span class="value">{{ displayName() }}</span>
        </div>
        <div class="divider" aria-hidden="true"></div>
        <div class="participant">
          <span class="label">Tracking</span>
          @if (activeParticipant()) {
            <span class="value">
              {{ activeParticipant()!.displayName || 'Participant' }}
              <span class="muted">(Age {{ activeParticipant()!.ageYears }})</span>
            </span>
          } @else {
            <span class="value muted">No active participant selected</span>
          }
        </div>
        <a class="switch" routerLink="/participants">
          @if (activeParticipant()) {
            Switch participant
          } @else {
            Select participant
          }
        </a>
      </section>
    }
  `,
  styles: [
    `
      .context-bar {
        display: flex;
        align-items: center;
        gap: var(--space-3, 0.75rem);
        padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
        background: #fff;
        border-bottom: 1px solid #e2e8f0;
        flex-wrap: wrap;
      }
      .avatar {
        width: 32px;
        height: 32px;
        border-radius: 999px;
        object-fit: cover;
      }
      .avatar.placeholder {
        background: #e2e8f0;
      }
      .identity {
        display: flex;
        flex-direction: column;
      }
      .participant {
        display: flex;
        flex-direction: column;
      }
      .label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-muted, #64748b);
      }
      .value {
        font-weight: 600;
      }
      .muted {
        color: var(--color-text-muted, #64748b);
        font-weight: 500;
      }
      .divider {
        width: 1px;
        align-self: stretch;
        background: #e2e8f0;
      }
      .switch {
        margin-left: auto;
        color: var(--color-primary, #0c4a6e);
        font-weight: 600;
        text-decoration: none;
        white-space: nowrap;
      }
      @media (max-width: 720px) {
        .divider {
          display: none;
        }
        .switch {
          margin-left: 0;
        }
      }
    `
  ]
})
export class ContextBarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly participants = inject(ParticipantService);

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly displayName = computed(() => {
    const user = this.auth.appUser();
    return user.name || user.email || 'Signed in';
  });
  readonly avatarUrl = computed(() => this.auth.appUser().picture || '');

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
}
