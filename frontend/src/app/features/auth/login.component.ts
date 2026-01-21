import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { GoogleIdentityService } from '../../shared/services/google-identity.service';
import { CardComponent } from '../../shared/ui/card/card.component';

/**
 * Sign-in screen that initializes the Google Identity Services button.
 */
@Component({
    selector: 'app-login',
    imports: [CardComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <app-card style="max-width: 420px; margin: 2rem auto;">
      <p class="app-title">TrackIt — ADHD Symptoms</p>
      <h1>Sign in as a Parent</h1>
      <p>Use your Google account to access your child's TrackIt Home.</p>
      @if (isLoadingGoogle()) {
        <p class="loading">Loading sign-in...</p>
      }
      <div id="g_id_signin"></div>
      @if (googleError()) {
        <p class="error">{{ googleError() }}</p>
      }
      @if (error) {
        <p class="error">{{ error }}</p>
      }
    </app-card>
    `,
    styles: [
        `
      .app-title {
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #64748b;
        margin-bottom: 0.5rem;
      }
      .loading {
        margin-top: 1rem;
        color: #64748b;
        font-style: italic;
      }
      .error {
        margin-top: 1rem;
        color: #b91c1c;
        font-weight: 600;
      }
    `
    ]
})
export class LoginComponent implements OnInit, OnDestroy {
  error?: string;
  private readonly auth = inject(AuthService);
  private readonly googleIdentity = inject(GoogleIdentityService);
  private readonly router = inject(Router);

  // Expose GoogleIdentityService signals to template
  readonly isLoadingGoogle = this.googleIdentity.isLoading;
  readonly googleError = this.googleIdentity.error;

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.router.navigate(['/home']);
      }
    });
  }

  /**
   * Redirects authenticated users and renders the Google sign-in button.
   */
  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/home']);
      return;
    }
    this.renderButton();
  }

  /**
   * Removes the GIS script when the component is destroyed.
   */
  ngOnDestroy(): void {
    const script = document.getElementById('g_id_onload');
    if (script) {
      script.remove();
    }
  }

  /**
   * Initializes the Google sign-in button once GIS library is ready.
   */
  private async renderButton(): Promise<void> {
    try {
      await this.googleIdentity.waitForGoogleIdentity();
      this.auth.renderGoogleButton('g_id_signin', (err) => (this.error = err));
    } catch (err) {
      console.error('[LoginComponent] Failed to load Google Identity Services:', err);
      // Error is already displayed via googleError signal
    }
  }
}
