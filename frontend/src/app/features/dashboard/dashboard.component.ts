import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { CardComponent } from '../../shared/ui/card/card.component';

/**
 * Dashboard landing page for authenticated users.
 */
@Component({
    selector: 'app-dashboard',
    imports: [CardComponent, RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <app-card>
      <h2>Welcome back, {{ auth.appUser().name }}!</h2>
      <p>Use the navigation above to access your TrackIt workspace.</p>
      <div class="actions">
        <a class="button" routerLink="/incidents/new">Log an incident</a>
        <a class="button secondary" routerLink="/incidents">View incidents</a>
      </div>
      <ul>
        <li>Email: {{ auth.appUser().email }}</li>
        <li>Role: {{ auth.appUser().role }}</li>
      </ul>
    </app-card>
  `,
    styles: [
      `
        .actions {
          display: flex;
          gap: var(--space-3, 0.75rem);
          flex-wrap: wrap;
          margin: var(--space-3, 0.75rem) 0;
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
        .button.secondary {
          background: #fff;
          color: var(--color-primary, #0c4a6e);
          border: 1px solid var(--color-primary, #0c4a6e);
        }
      `
    ]
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
}
