import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card/card.component';

@Component({
  selector: 'app-participant-start',
  imports: [RouterLink, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card>
      <h2>Let's create your first participant</h2>
      <p class="muted">
        Participants help you organize who you are tracking in TrackIt.
      </p>

      <a class="button" routerLink="/participants/new">Create participant</a>
    </app-card>
  `,
  styles: [
    `
      h2 {
        margin: 0 0 var(--space-2, 0.5rem);
      }
      .muted {
        margin: 0 0 var(--space-3, 0.75rem);
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
      }
    `
  ]
})
export class ParticipantStartComponent {}
