import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { httpResource } from '@angular/common/http';
import { CardComponent } from '../../shared/ui/card/card.component';
import { ArrowRightIconComponent } from '../../shared/ui/icons/arrow-right-icon.component';
import { Participant } from '../../shared/models/participant';
import { ParticipantService } from '../../shared/services/participant.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-participant-list',
  imports: [RouterLink, CardComponent, ArrowRightIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card class="card">
      <div class="header">
        <div>
          <h2>Your participants</h2>
          <p class="muted">
            This list lets you choose who you want to track. Select a participant to set them as active.
          </p>
        </div>
        <a class="button" routerLink="/participants/new">Create participant</a>
      </div>

      @if (participantsResource.isLoading()) {
        <p class="muted">Loading participants...</p>
      } @else if (participantsResource.error()) {
        <p class="error" role="alert">Unable to load participants.</p>
      } @else if (participants().length === 0) {
        <div class="empty">
          <p class="muted">You do not have any participants yet.</p>
          <a class="button" routerLink="/participants/new">Create your first participant</a>
        </div>
      } @else {
        <ul class="list" role="list">
          @for (participant of participants(); track participant.id) {
            <li>
              <div
                class="participant"
                role="button"
                tabindex="0"
                [class.active]="participant.id === activeParticipantId()"
                (click)="selectParticipant(participant)"
                (keydown.enter)="selectParticipant(participant)"
                (keydown.space)="selectParticipant(participant)"
              >
                <div class="info">
                  <div class="name">
                    {{ participant.displayName || fallbackName(participant) }}
                    @if (participant.id === activeParticipantId()) {
                      <span class="badge">Active</span>
                    }
                  </div>
                  <div class="meta">Age {{ participant.ageYears }}</div>
                </div>
                <div class="actions">
                  <a class="link" routerLink="/dashboard" (click)="$event.stopPropagation()">
                    <span>Go to dashboard</span>
                    <app-icon-arrow-right />
                  </a>
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </app-card>
  `,
  styles: [
    `
      .card {
        max-width: var(--layout-card-max, 36rem);
        margin: var(--space-6, 2rem) auto;
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: var(--space-4, 1rem);
        align-items: center;
        margin-bottom: var(--space-4, 1rem);
        flex-wrap: wrap;
      }
      h2 {
        margin: 0 0 var(--space-1, 0.25rem);
      }
      .muted {
        margin: 0;
        color: var(--color-text-muted, #64748b);
      }
      .button {
        display: inline-block;
        background: var(--color-primary, #0c4a6e);
        color: #fff;
        padding: 0.6rem 1rem;
        border-radius: var(--radius-2, 0.5rem);
        text-decoration: none;
        font-weight: 600;
        border: none;
      }
      .list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: var(--space-3, 0.75rem);
      }
      .list li {
        width: 100%;
      }
      .participant {
        width: 100%;
        text-align: left;
        padding: 0.9rem 1rem;
        border-radius: var(--radius-2, 0.5rem);
        border: 1px solid #e2e8f0;
        background: #fff;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--space-3, 0.75rem);
        box-sizing: border-box;
      }
      .participant.active {
        border-color: var(--color-primary, #0c4a6e);
        box-shadow: 0 0 0 2px rgba(12, 74, 110, 0.2);
      }
      .info {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .actions {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3, 0.75rem);
        flex-wrap: wrap;
      }
      .link {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: var(--color-primary, #0c4a6e);
        font-weight: 600;
        text-decoration: none;
        padding: 0.35rem 0;
        white-space: nowrap;
      }
      .name {
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: var(--space-2, 0.5rem);
      }
      .meta {
        color: var(--color-text-muted, #64748b);
      }
      .badge {
        font-size: 0.75rem;
        padding: 0.1rem 0.45rem;
        border-radius: 999px;
        background: rgba(12, 74, 110, 0.12);
        color: var(--color-primary, #0c4a6e);
      }
      .error {
        margin: 0;
        color: #b91c1c;
        font-weight: 600;
      }
      .empty {
        display: grid;
        gap: var(--space-2, 0.5rem);
      }
      @media (max-width: 600px) {
        .header {
          align-items: flex-start;
        }
        .button {
          width: 100%;
          text-align: center;
        }
      }
    `
  ]
})
export class ParticipantListComponent {
  private readonly participantsService = inject(ParticipantService);

  readonly participantsResource = httpResource<{ items: Participant[] }>(() => ({
    url: `${environment.apiBaseUrl}/participants`,
    method: 'GET',
    params: {
      pageSize: '50'
    }
  }));

  readonly participants = computed(() =>
    this.participantsResource.hasValue() ? this.participantsResource.value().items : []
  );
  readonly activeParticipantId = this.participantsService.activeParticipantId;

  selectParticipant(participant: Participant) {
    this.participantsService.setActiveParticipant(participant.id);
  }

  fallbackName(participant: Participant): string {
    const index = this.participants().findIndex((item) => item.id === participant.id);
    return index >= 0 ? `Participant ${index + 1}` : 'Participant';
  }
}
