import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../shared/services/auth.service';
import { CardComponent } from '../../shared/ui/card/card.component';

@Component({
    selector: 'app-dashboard',
    imports: [CardComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <app-card>
      <h2>Welcome back, {{ auth.appUser().name }}!</h2>
      <p>Use the navigation above to access your TrackIt workspace.</p>
      <ul>
        <li>Email: {{ auth.appUser().email }}</li>
        <li>Role: {{ auth.appUser().role }}</li>
      </ul>
    </app-card>
  `,
    styles: []
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
}
