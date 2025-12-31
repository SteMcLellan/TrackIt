import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './shared/services/auth.service';

/**
 * Root application shell that hosts the router outlet and top-level actions.
 */
@Component({
    selector: 'app-root',
    imports: [RouterOutlet, RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * Clears the current session and returns the user to the login page.
   */
  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
