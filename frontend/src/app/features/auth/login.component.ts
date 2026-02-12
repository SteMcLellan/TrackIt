import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { GoogleIdentityService } from '../../shared/services/google-identity.service';
import { TrackItTrendlineLogoIconComponent } from '../../shared/ui/icons/trackit-trendline-logo-icon.component';

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/40de48a457ef43beab1f50b6742a7664
 * @stitch-screen-title TrackIt Trendline Logo Identity
 * @stitch-status converted
 * @stitch-last-sync 2026-02-11
 *
 * Sign-in screen that initializes the Google Identity Services button.
 * Supports returnUrl query parameter for post-login redirect.
 */
@Component({
  selector: 'app-login',
  imports: [TrackItTrendlineLogoIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="background-grid" aria-hidden="true"></div>

      <main class="shell">
        <header class="hero">
          <div class="brand-mark-wrap" aria-hidden="true">
            <app-icon-trackit-trendline-logo class="logo" />
          </div>
          <div class="brand-text">
            <h1 class="brand-name">Track<span>It</span></h1>
            <p class="brand-tagline">Understanding the rhythm of every day</p>
          </div>
        </header>

        <section class="signin-shell" aria-label="Google sign-in">
          <div id="g_id_signin"></div>
        </section>

        <a class="help-text" href="#">Need help getting started?</a>
      </main>
    </div>
  `,
  styles: [`
    .page {
      position: relative;
      min-height: 100svh;
      display: grid;
      place-items: center;
      overflow: hidden;
      padding: calc(var(--space-5, 1.5rem) + env(safe-area-inset-top, 0px))
        var(--container-padding, var(--space-3, 0.75rem))
        calc(var(--space-5, 1.5rem) + env(safe-area-inset-bottom, 0px));
      background: #ffffff;
    }
    .background-grid {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.03;
      background-image: radial-gradient(#1f2937 1px, transparent 1px);
      background-size: 32px 32px;
    }
    .shell {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 390px;
      display: grid;
      justify-items: center;
      gap: 0;
    }
    .hero {
      display: grid;
      justify-items: center;
      gap: 0;
      text-align: center;
      margin-bottom: 3rem;
    }
    .logo {
      width: 100%;
      height: 100%;
    }
    .brand-mark-wrap {
      width: 16rem;
      height: 14rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 2rem;
    }
    .brand-text {
      display: grid;
      gap: 1rem;
    }
    .brand-name {
      margin: 0;
      font-weight: 700;
      font-size: clamp(2.4rem, 9vw, 3rem);
      letter-spacing: -0.02em;
      color: #1f2937;
      line-height: 1.1;
    }
    .brand-name span {
      color: var(--color-vital-emerald, #10b981);
    }
    .brand-tagline {
      margin: 0;
      max-width: 220px;
      color: #94a3b8;
      font-size: 1rem;
      font-weight: 400;
      line-height: 1.5;
    }
    .signin-shell {
      width: 100%;
      max-width: 280px;
      display: flex;
      justify-content: center;
      margin-bottom: 4rem;
    }
    #g_id_signin {
      display: flex;
      justify-content: center;
      width: 100%;
      min-height: 44px;
    }
    .help-text {
      margin: 0;
      text-align: center;
      font-size: var(--font-size-xs, 0.75rem);
      color: #94a3b8;
      text-decoration: none;
      transition: color var(--transition-fast, 120ms ease);
    }
    .help-text:hover {
      color: var(--color-vital-emerald, #10b981);
    }
  `]
})
export class LoginComponent implements OnInit, OnDestroy {
  error?: string;
  private readonly auth = inject(AuthService);
  private readonly googleIdentity = inject(GoogleIdentityService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Extract returnUrl from query params
  private readonly returnUrl = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('returnUrl'))),
    { initialValue: null }
  );

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        const returnUrl = this.returnUrl();
        // Navigate to returnUrl if present and valid, otherwise default to /insights
        if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('/login')) {
          this.router.navigateByUrl(returnUrl);
        } else {
          this.router.navigate(['/insights']);
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
        this.router.navigate(['/insights']);
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

