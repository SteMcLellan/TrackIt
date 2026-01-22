import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { GoogleIdentityService } from '../../shared/services/google-identity.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { TrackItLogoIconComponent } from '../../shared/ui/icons/trackit-logo-icon.component';

/**
 * Sign-in screen that initializes the Google Identity Services button.
 * Supports returnUrl query parameter for post-login redirect.
 */
@Component({
  selector: 'app-login',
  imports: [CardComponent, TrackItLogoIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <main class="shell">
        <header class="hero">
          <div class="brand">
            <div class="logo-badge" aria-hidden="true">
              <app-icon-trackit-logo class="logo" />
            </div>
            <div class="brand-text">
              <div class="brand-name">TrackIt</div>
              <div class="brand-tagline">Caregiver tools for daily tracking</div>
            </div>
          </div>
        </header>

        <app-card class="card">
          <h1>Sign in</h1>
          <p class="subhead">Use your Google account to continue.</p>

          <div class="signin-panel" aria-label="Google sign-in" aria-live="polite">
            @if (isLoadingGoogle()) {
              <p class="loading">Loading sign-in...</p>
            }
            <div id="g_id_signin"></div>
          </div>

          @if (googleError()) {
            <p class="error" role="alert">{{ googleError() }}</p>
          }
          @if (error) {
            <p class="error" role="alert">{{ error }}</p>
          }

          <p class="fineprint">Secure sign-in via Google.</p>
        </app-card>
      </main>
    </div>
  `,
  styles: [`
    .page {
      min-height: 100svh;
      display: grid;
      place-items: center;
      padding: calc(var(--space-5, 1.5rem) + env(safe-area-inset-top, 0px))
        var(--container-padding, var(--space-3, 0.75rem))
        calc(var(--space-5, 1.5rem) + env(safe-area-inset-bottom, 0px));
      background:
        radial-gradient(900px circle at 50% 0%, rgba(12, 74, 110, 0.14), transparent 55%),
        var(--color-bg, #f1f5f9);
    }
    .shell {
      width: 100%;
      max-width: 420px;
      display: grid;
      gap: var(--space-5, 1.5rem);
    }
    .hero {
      display: grid;
      gap: var(--space-4, 1rem);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: var(--space-3, 0.75rem);
    }
    .logo-badge {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      background: rgba(12, 74, 110, 0.12);
      color: var(--color-primary, #0c4a6e);
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.04));
      border: 1px solid rgba(12, 74, 110, 0.18);
    }
    .logo {
      width: 28px;
      height: 28px;
    }
    .brand-text {
      display: grid;
      gap: 0.1rem;
    }
    .brand-name {
      font-weight: 800;
      font-size: 1.35rem;
      letter-spacing: -0.02em;
      color: #0f172a;
      line-height: 1.1;
    }
    .brand-tagline {
      color: var(--color-text-muted, #64748b);
      font-weight: 600;
      font-size: var(--font-size-sm, 0.8125rem);
    }
    .card {
      display: grid;
      gap: var(--space-3, 0.75rem);
    }
    h1 {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .subhead {
      margin: 0;
      color: var(--color-text-muted, #64748b);
      font-weight: 550;
    }
    .signin-panel {
      display: grid;
      gap: var(--space-2, 0.5rem);
      padding: var(--space-3, 0.75rem);
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-2, 0.5rem);
      background: #f8fafc;
    }
    #g_id_signin {
      display: flex;
      justify-content: center;
    }
    .loading {
      margin: 0;
      color: var(--color-text-muted, #64748b);
      font-style: italic;
    }
    .error {
      margin: 0;
      color: #b91c1c;
      font-weight: 650;
    }
    .fineprint {
      margin: 0;
      color: var(--color-text-muted, #64748b);
      font-size: var(--font-size-xs, 0.75rem);
    }
  `]
})
export class LoginComponent implements OnInit, OnDestroy {
  error?: string;
  private readonly auth = inject(AuthService);
  private readonly googleIdentity = inject(GoogleIdentityService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Expose GoogleIdentityService signals to template
  readonly isLoadingGoogle = this.googleIdentity.isLoading;
  readonly googleError = this.googleIdentity.error;

  // Extract returnUrl from query params
  private readonly returnUrl = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('returnUrl'))),
    { initialValue: null }
  );

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        const returnUrl = this.returnUrl();
        // Navigate to returnUrl if present and valid, otherwise default to /home
        if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('/login')) {
          this.router.navigateByUrl(returnUrl);
        } else {
          this.router.navigate(['/home']);
        }
      }
    });
  }

  /**
   * Redirects authenticated users and renders the Google sign-in button.
   */
  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      const returnUrl = this.returnUrl();
      if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('/login')) {
        this.router.navigateByUrl(returnUrl);
      } else {
        this.router.navigate(['/home']);
      }
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
