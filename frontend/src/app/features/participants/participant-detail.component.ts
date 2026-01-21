import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CardComponent } from '../../shared/ui/card/card.component';
import { Participant } from '../../shared/models/participant';
import { environment } from '../../../environments/environment';
import { ParticipantEditFormComponent } from './participant-edit-form.component';
import { ParticipantInviteService } from '../../shared/services/participant-invite.service';

@Component({
  selector: 'app-participant-detail',
  imports: [RouterLink, CardComponent, ParticipantEditFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card class="card">
      <a class="link" routerLink="/participants">Back to participants</a>

      @if (participantResource.isLoading()) {
        <p class="muted">Loading participant...</p>
      } @else if (participantResource.error()) {
        <p class="error" role="alert">Unable to load participant.</p>
      } @else {
        <div class="header">
          <div>
            <h2>{{ displayName() }}</h2>
            <p class="muted">Age {{ participant()?.ageYears }}</p>
          </div>
          @if (participant()?.role === 'manager') {
            <button class="button secondary" type="button" (click)="startEdit()">Edit</button>
          }
        </div>

        @if (editing()) {
          <app-participant-edit-form
            [participant]="participant()!"
            (cancel)="cancelEdit()"
            (saved)="handleSaved($event)"
          />
        }

        @if (participant()?.role === 'manager') {
          <section class="section invite">
            <div class="invite-header">
              <div>
                <h3>Share invite</h3>
                <p class="muted">Anyone with the link can join.</p>
                @if (inviteExpiresLabel()) {
                  <p class="muted">{{ inviteExpiresLabel() }}</p>
                }
              </div>
              <button
                class="button secondary"
                type="button"
                [disabled]="inviteStatus() === 'loading'"
                (click)="createInvite()"
              >
                @if (inviteStatus() === 'loading') {
                  <span>Creating...</span>
                } @else {
                  <span>Copy invite link</span>
                }
              </button>
            </div>

            @if (inviteLink()) {
              <div class="invite-link">
                <input class="invite-input" type="text" [value]="inviteLink()!" readonly />
                <button class="button secondary" type="button" (click)="copyInviteLink()">
                  Copy again
                </button>
              </div>
            }

            @if (inviteMessage()) {
              <p class="status" [class.error]="inviteStatus() === 'error'">{{ inviteMessage() }}</p>
            }
          </section>
        }

        <section class="section">
          <h3>Tracking history</h3>
          <p class="muted">Tracking history will appear here as you log entries.</p>
        </section>
      }
    </app-card>
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
      }
      .card {
        max-width: var(--layout-card-max, 36rem);
        margin: var(--space-6, 2rem) auto;
      }
      .link {
        display: inline-flex;
        margin-bottom: var(--space-3, 0.75rem);
        color: var(--color-primary, #0c4a6e);
        font-weight: 600;
        text-decoration: none;
      }
      h2 {
        margin: 0 0 var(--space-2, 0.5rem);
      }
      .muted {
        margin: 0 0 var(--space-3, 0.75rem);
        color: var(--color-text-muted, #64748b);
      }
      .section {
        margin-top: var(--space-4, 1rem);
        padding-top: var(--space-3, 0.75rem);
        border-top: 1px solid #e2e8f0;
      }
      .invite {
        display: grid;
        gap: var(--space-3, 0.75rem);
      }
      .invite-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
      }
      .invite-link {
        display: flex;
        align-items: center;
        gap: var(--space-2, 0.5rem);
        flex-wrap: wrap;
      }
      .invite-input {
        flex: 1 1 14rem;
        min-width: 12rem;
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius-2, 0.5rem);
        border: 1px solid #cbd5f5;
        font-size: 0.95rem;
      }
      .status {
        margin: 0;
        font-weight: 600;
        color: #0f766e;
      }
      .status.error {
        color: #b91c1c;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-primary, #0c4a6e);
        color: #fff;
        padding: 0.55rem 1.1rem;
        border-radius: var(--radius-2, 0.5rem);
        text-decoration: none;
        font-weight: 600;
        border: none;
        cursor: pointer;
      }
      .button.secondary {
        background: #fff;
        color: var(--color-primary, #0c4a6e);
        border: 1px solid var(--color-primary, #0c4a6e);
      }
    `
  ]
})
export class ParticipantDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly inviteService = inject(ParticipantInviteService);

  readonly participantId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' }
  );

  readonly participantResource = httpResource<Participant>(() => ({
    url: `${environment.apiBaseUrl}/participants/${this.participantId()}`,
    method: 'GET'
  }));

  readonly participantOverride = signal<Participant | null>(null);
  readonly editing = signal(false);
  readonly inviteStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly inviteLink = signal<string | null>(null);
  readonly inviteExpiresAt = signal<string | null>(null);
  readonly inviteMessage = signal<string | null>(null);

  readonly participant = computed(() =>
    this.participantOverride() ?? (this.participantResource.hasValue() ? this.participantResource.value() : null)
  );

  readonly displayName = computed(() => {
    const participant = this.participant();
    if (!participant) {
      return 'Participant';
    }
    return participant.displayName?.trim() || 'Participant';
  });

  readonly inviteExpiresLabel = computed(() => {
    const expiresAt = this.inviteExpiresAt();
    if (!expiresAt) {
      return '';
    }
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return 'Expires soon';
    }
    const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
    return `Expires ${formatter.format(parsed)}`;
  });

  startEdit() {
    const participant = this.participant();
    if (!participant) {
      return;
    }
    this.editing.set(true);
  }

  cancelEdit() {
    this.editing.set(false);
  }

  handleSaved(updated: Participant) {
    this.participantOverride.set(updated);
    this.editing.set(false);
  }

  createInvite() {
    const participantId = this.participantId();
    if (!participantId) {
      return;
    }
    this.inviteStatus.set('loading');
    this.inviteMessage.set(null);

    this.inviteService.createInvite(participantId).subscribe({
      next: (response) => {
        const link = `${window.location.origin}/invite/${response.participantId}/${response.inviteId}`;
        this.inviteLink.set(link);
        this.inviteExpiresAt.set(response.expiresAt);
        this.inviteStatus.set('ready');
        void this.copyToClipboard(link);
      },
      error: () => {
        this.inviteStatus.set('error');
        this.inviteMessage.set('Unable to create invite link.');
      }
    });
  }

  copyInviteLink() {
    const link = this.inviteLink();
    if (!link) {
      return;
    }
    void this.copyToClipboard(link);
  }

  private async copyToClipboard(link: string) {
    try {
      if (!navigator?.clipboard?.writeText) {
        this.inviteMessage.set('Invite link ready to copy.');
        return;
      }
      await navigator.clipboard.writeText(link);
      this.inviteMessage.set('Invite link copied to clipboard.');
    } catch {
      this.inviteMessage.set('Invite link ready to copy.');
    }
  }
}
