import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CardComponent } from '../../shared/ui/card.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { Participant } from '../../shared/models/participant';
import { ParticipantMember } from '../../shared/models/participant-invite';
import { CollectionResponse } from '../../shared/models/collection';
import { environment } from '../../../environments/environment';
import { ParticipantEditFormComponent } from './participant-edit-form.component';
import { ParticipantInviteService } from '../../shared/services/participant-invite.service';

@Component({
  selector: 'app-participant-detail',
  imports: [RouterLink, CardComponent, SkeletonComponent, ParticipantEditFormComponent],
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

          <section class="section members">
            <h3>Members</h3>
            <p class="muted">People with access to this participant.</p>

            @if (membersResource.isLoading()) {
              <ul class="member-list" aria-label="Loading members">
                @for (i of [1, 2]; track i) {
                  <li class="member-item">
                    <app-skeleton variant="circle" width="40px" height="40px" />
                    <div class="member-info">
                      <app-skeleton width="120px" height="1rem" />
                      <app-skeleton width="80px" height="0.8rem" />
                    </div>
                  </li>
                }
              </ul>
            } @else if (membersResource.error()) {
              <p class="error">Unable to load members.</p>
            } @else if (members().length === 0) {
              <p class="muted">No members found.</p>
            } @else {
              <ul class="member-list" role="list">
                @for (member of members(); track member.userId) {
                  <li class="member-item">
                    @if (member.picture) {
                      <img class="avatar" [src]="member.picture" [alt]="member.name" />
                    } @else {
                      <div class="avatar placeholder">
                        {{ member.name.charAt(0).toUpperCase() }}
                      </div>
                    }
                    <div class="member-info">
                      <div class="member-name">
                        {{ member.name }}
                        @if (member.isMe) {
                          <span class="me-badge">me</span>
                        }
                      </div>
                      <div class="member-role">{{ member.role | titlecase }}</div>
                    </div>
                    @if (!member.isMe) {
                      <button
                        class="button-text danger"
                        type="button"
                        [disabled]="revokingUserId() === member.userId"
                        (click)="confirmRevoke(member)"
                      >
                        @if (revokingUserId() === member.userId) {
                          Removing...
                        } @else {
                          Remove
                        }
                      </button>
                    }
                  </li>
                }
              </ul>
            }

            @if (revokeError()) {
              <p class="error">{{ revokeError() }}</p>
            }
          </section>
        }

        <section class="section">
          <h3>Tracking history</h3>
          <p class="muted">Tracking history will appear here as you log entries.</p>
        </section>
      }
    </app-card>

    @if (confirmingRevoke()) {
      <div class="modal-backdrop" (click)="cancelRevoke()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="revoke-title" (click)="$event.stopPropagation()">
          <h3 id="revoke-title">Remove access?</h3>
          <p>
            Are you sure you want to remove <strong>{{ confirmingRevoke()!.name }}</strong> from this participant?
            They will no longer be able to view or manage this data.
          </p>
          <div class="modal-actions">
            <button class="button secondary" type="button" (click)="cancelRevoke()">Cancel</button>
            <button class="button danger" type="button" (click)="executeRevoke()">Remove access</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
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
    h3 {
      margin: 0 0 var(--space-1, 0.25rem);
      font-size: var(--font-size-base, 0.9375rem);
    }
    .muted {
      margin: 0 0 var(--space-3, 0.75rem);
      color: var(--color-text-muted, #64748b);
      font-size: var(--font-size-sm, 0.8125rem);
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
    .members {
      display: grid;
      gap: var(--space-3, 0.75rem);
    }
    .member-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: var(--space-2, 0.5rem);
    }
    .member-item {
      display: flex;
      align-items: center;
      gap: var(--space-3, 0.75rem);
      padding: var(--space-3, 0.75rem);
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-2, 0.5rem);
      background: #fff;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .avatar.placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary, #0c4a6e);
      color: #fff;
      font-weight: 600;
      font-size: var(--font-size-base, 0.9375rem);
    }
    .member-info {
      flex: 1;
      min-width: 0;
    }
    .member-name {
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: var(--space-2, 0.5rem);
    }
    .me-badge {
      display: inline-flex;
      padding: 0.1rem 0.4rem;
      border-radius: var(--radius-full, 999px);
      background: rgba(12, 74, 110, 0.1);
      color: var(--color-primary, #0c4a6e);
      font-size: var(--font-size-xs, 0.75rem);
      font-weight: 600;
      text-transform: lowercase;
    }
    .member-role {
      color: var(--color-text-muted, #64748b);
      font-size: var(--font-size-sm, 0.8125rem);
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
    .button.danger {
      background: #dc2626;
      color: #fff;
      border: none;
    }
    .button-text {
      background: none;
      border: none;
      padding: 0.35rem 0.6rem;
      font-weight: 600;
      cursor: pointer;
      border-radius: var(--radius-1, 0.25rem);
    }
    .button-text.danger {
      color: #dc2626;
    }
    .button-text.danger:hover {
      background: rgba(220, 38, 38, 0.08);
    }
    .button-text:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error {
      margin: 0;
      color: #b91c1c;
      font-weight: 600;
      font-size: var(--font-size-sm, 0.8125rem);
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-4, 1rem);
      z-index: 100;
    }
    .modal {
      background: #fff;
      border-radius: var(--radius-3, 0.75rem);
      padding: var(--space-5, 1.5rem);
      max-width: 400px;
      width: 100%;
      box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.08));
    }
    .modal h3 {
      margin: 0 0 var(--space-3, 0.75rem);
      font-size: var(--font-size-lg, 1.125rem);
    }
    .modal p {
      margin: 0 0 var(--space-4, 1rem);
      color: var(--color-text-muted, #64748b);
    }
    .modal-actions {
      display: flex;
      gap: var(--space-2, 0.5rem);
      justify-content: flex-end;
    }
  `]
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

  readonly membersResource = httpResource<CollectionResponse<ParticipantMember>>(() => {
    const id = this.participantId();
    const participant = this.participant();
    // Only fetch members if user is a manager
    if (!id || participant?.role !== 'manager') {
      return undefined;
    }
    this.membersRefreshTick();
    return {
      url: `${environment.apiBaseUrl}/participants/${id}/members`,
      method: 'GET'
    };
  });

  readonly participantOverride = signal<Participant | null>(null);
  readonly editing = signal(false);
  readonly inviteStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly inviteLink = signal<string | null>(null);
  readonly inviteExpiresAt = signal<string | null>(null);
  readonly inviteMessage = signal<string | null>(null);
  readonly membersRefreshTick = signal(0);
  readonly confirmingRevoke = signal<ParticipantMember | null>(null);
  readonly revokingUserId = signal<string | null>(null);
  readonly revokeError = signal<string | null>(null);

  readonly participant = computed(() =>
    this.participantOverride() ?? (this.participantResource.hasValue() ? this.participantResource.value() : null)
  );

  readonly members = computed(() =>
    this.membersResource.hasValue() ? this.membersResource.value().items : []
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

  confirmRevoke(member: ParticipantMember) {
    this.revokeError.set(null);
    this.confirmingRevoke.set(member);
  }

  cancelRevoke() {
    this.confirmingRevoke.set(null);
  }

  executeRevoke() {
    const member = this.confirmingRevoke();
    const participantId = this.participantId();
    if (!member || !participantId) {
      return;
    }

    this.revokingUserId.set(member.userId);
    this.confirmingRevoke.set(null);
    this.revokeError.set(null);

    this.inviteService.revokeMember(participantId, member.userId).subscribe({
      next: () => {
        this.revokingUserId.set(null);
        // Refresh members list
        this.membersRefreshTick.update((v) => v + 1);
      },
      error: (err) => {
        this.revokingUserId.set(null);
        const message = err?.error?.message;
        if (err.status === 409) {
          this.revokeError.set(message || 'Cannot remove the last manager.');
        } else {
          this.revokeError.set(message || 'Unable to remove member. Please try again.');
        }
      }
    });
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
