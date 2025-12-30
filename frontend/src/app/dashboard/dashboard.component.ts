import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../core/services/auth.service';

@Component({
    selector: 'app-dashboard',
    imports: [],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <section class="panel">
      <h2>Welcome back, {{ auth.appUser().name }}!</h2>
      <p>Use the navigation above to access your TrackIt workspace.</p>
      <ul>
        <li>Email: {{ auth.appUser().email }}</li>
        <li>Role: {{ auth.appUser().role }}</li>
      </ul>
    </section>
  `,
    styles: [
        `
      .panel {
        background: #fff;
        padding: 1.5rem;
        border-radius: 0.5rem;
        border: 1px solid #e2e8f0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      }
    `
    ]
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
}
