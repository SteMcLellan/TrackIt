import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CardComponent } from '../../shared/ui/card.component';
import { ParticipantInviteService } from '../../shared/services/participant-invite.service';
import { ParticipantService } from '../../shared/services/participant.service';
import { AcceptInviteResponse } from '../../shared/models/participant-invite';

type AcceptStatus = 'loading' | 'success' | 'already-linked' | 'error';

@Component({
  selector: 'app-invite-accept',
  imports: [CardComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card class="card">
      @switch (status()) {
        @case ('loading') {
          <div class="center">
            <h2>Accepting invite...</h2>
            <p class="muted">Please wait while we process your invite.</p>
          </div>
        }
        @case ('success') {
          <div class="center">
            <div class="icon success-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2>You're in!</h2>
            <p>You now have access to <strong>{{ participantName() }}</strong>.</p>
            <div class="actions">
              <button class="button" type="button" (click)="setActiveAndGo()">
                Set as active & go to Home
              </button>
              <a class="button secondary" [routerLink]="['/participants', participantId()]">
                View participant
              </a>
            </div>
          </div>
        }
        @case ('already-linked') {
          <div class="center">
            <div class="icon info-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>
            <h2>Already connected</h2>
            <p>You already have access to <strong>{{ participantName() }}</strong>.</p>
            <div class="actions">
              <button class="button" type="button" (click)="setActiveAndGo()">
                Set as active & go to Home
              </button>
              <a class="button secondary" routerLink="/participants">
                View all participants
              </a>
            </div>
          </div>
        }
        @case ('error') {
          <div class="center">
            <div class="icon error-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h2>Invite not valid</h2>
            <p class="error-message">{{ errorMessage() }}</p>
            <p class="muted">Ask the person who shared this invite to generate a new one.</p>
            <div class="actions">
              <a class="button secondary" routerLink="/participants">
                Go to participants
              </a>
              <a class="button secondary" routerLink="/home">
                Go to Home
              </a>
            </div>
          </div>
        }
      }
    </app-card>
  `,
  styles: [`
    .card {
      max-width: 420px;
      margin: var(--space-6, 2rem) auto;
      text-align: center;
    }
    .center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3, 0.75rem);
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--space-2, 0.5rem);
    }
    .icon svg {
      width: 28px;
      height: 28px;
    }
    .success-icon {
      background: rgba(34, 197, 94, 0.12);
      color: #16a34a;
    }
    .info-icon {
      background: rgba(59, 130, 246, 0.12);
      color: #2563eb;
    }
    .error-icon {
      background: rgba(239, 68, 68, 0.12);
      color: #dc2626;
    }
    h2 {
      margin: 0;
      font-size: var(--font-size-xl, 1.25rem);
    }
    p {
      margin: 0;
    }
    .muted {
      color: var(--color-text-muted, #64748b);
      font-size: var(--font-size-sm, 0.8125rem);
    }
    .error-message {
      color: #b91c1c;
      font-weight: 600;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-2, 0.5rem);
      width: 100%;
      margin-top: var(--space-3, 0.75rem);
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary, #0c4a6e);
      color: #fff;
      padding: 0.65rem 1.25rem;
      border-radius: var(--radius-2, 0.5rem);
      text-decoration: none;
      font-weight: 600;
      border: none;
      cursor: pointer;
      width: 100%;
    }
    .button.secondary {
      background: #fff;
      color: var(--color-primary, #0c4a6e);
      border: 1px solid var(--color-primary, #0c4a6e);
    }
  `]
})
export class InviteAcceptComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inviteService = inject(ParticipantInviteService);
  private readonly participantService = inject(ParticipantService);

  readonly participantId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('participantId') ?? '')),
    { initialValue: '' }
  );

  readonly inviteId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('inviteId') ?? '')),
    { initialValue: '' }
  );

  readonly status = signal<AcceptStatus>('loading');
  readonly acceptResponse = signal<AcceptInviteResponse | null>(null);
  readonly errorMessage = signal<string>('This invite is no longer valid.');

  readonly participantName = computed(() => {
    const response = this.acceptResponse();
    return response?.participantDisplayName || 'this participant';
  });

  ngOnInit(): void {
    this.acceptInvite();
  }

  private acceptInvite(): void {
    const participantId = this.participantId();
    const inviteId = this.inviteId();

    if (!participantId || !inviteId) {
      this.status.set('error');
      this.errorMessage.set('Invalid invite link.');
      return;
    }

    this.inviteService.acceptInvite(participantId, inviteId).subscribe({
      next: (response) => {
        this.acceptResponse.set(response);
        if (response.alreadyLinked) {
          this.status.set('already-linked');
        } else {
          this.status.set('success');
        }
      },
      error: (err) => {
        this.status.set('error');
        const message = err?.error?.message;
        if (message) {
          this.errorMessage.set(message);
        } else if (err.status === 403) {
          this.errorMessage.set('This invite has expired or already been used.');
        } else if (err.status === 404) {
          this.errorMessage.set('Invite not found.');
        } else {
          this.errorMessage.set('Unable to accept invite. Please try again.');
        }
      }
    });
  }

  setActiveAndGo(): void {
    const participantId = this.participantId();
    if (participantId) {
      this.participantService.setActiveParticipant(participantId);
    }
    this.router.navigate(['/home']);
  }
}
