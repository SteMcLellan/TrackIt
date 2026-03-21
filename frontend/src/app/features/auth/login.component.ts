import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { ClerkService } from '../../shared/services/clerk.service';
import { TrackItTrendlineLogoIconComponent } from '../../shared/ui/icons/trackit-trendline-logo-icon.component';

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/40de48a457ef43beab1f50b6742a7664
 * @stitch-screen-title TrackIt Trendline Logo Identity
 * @stitch-status converted
 * @stitch-last-sync 2026-02-11
 *
 * Sign-in screen that renders Clerk's hosted sign-in component.
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

        <section class="signin-shell" aria-label="Sign in">
          @if (error) {
            <div class="signin-error-card" role="alert" aria-live="polite">
              <p class="signin-error-title">Sign-in is unavailable</p>
              <p class="signin-error">{{ error }}</p>
              <p class="signin-error-hint">Verify the Clerk frontend configuration, then reload this page.</p>
            </div>
          } @else if (!showSyncMessage()) {
            <div id="clerk-sign-in"></div>
          } @else {
            <p class="signin-status">Finishing sign-in...</p>
          }
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
    #clerk-sign-in {
      display: flex;
      justify-content: center;
      width: 100%;
      min-height: 44px;
    }
    .signin-error-card {
      width: 100%;
      padding: 1rem;
      border-radius: 1rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      display: grid;
      gap: 0.375rem;
    }
    .signin-error-title,
    .signin-error,
    .signin-error-hint,
    .signin-status {
      margin: 0;
      text-align: center;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    .signin-error-title {
      color: #991b1b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      font-size: 0.75rem;
    }
    .signin-error {
      color: #b91c1c;
    }
    .signin-error-hint,
    .signin-status {
      color: #475569;
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
  private readonly clerk = inject(ClerkService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly returnUrl = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('returnUrl'))),
    { initialValue: null }
  );

  readonly showSyncMessage = computed(() => this.clerk.isSignedIn() && !this.auth.isAuthenticated());

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        const returnUrl = this.returnUrl();
        if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('/login')) {
          this.router.navigateByUrl(returnUrl);
        } else {
          this.router.navigate(['/insights']);
        }
      }
    });
  }

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

    void this.renderSignIn();
  }

  ngOnDestroy(): void {
    this.clerk.unmountSignIn('clerk-sign-in');
  }

  private async renderSignIn(): Promise<void> {
    try {
      await this.clerk.initialize();
      this.error = this.clerk.error() ?? undefined;

      if (this.error || this.clerk.isSignedIn()) {
        return;
      }

      await this.clerk.mountSignIn('clerk-sign-in', this.returnUrl());
    } catch (err) {
      console.error('[LoginComponent] Failed to mount Clerk sign-in:', err);
      this.error = err instanceof Error ? err.message : 'Unable to load sign-in.';
    }
  }
}
