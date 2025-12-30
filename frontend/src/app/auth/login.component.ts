import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

@Component({
    selector: 'app-login',
    imports: [],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <section class="card">
      <h1>Sign in with Google</h1>
      <p>Authenticate to access your protected TrackIt data.</p>
      <div id="g_id_signin"></div>
      @if (error) {
        <p class="error">{{ error }}</p>
      }
    </section>
    `,
    styles: [
        `
      .card {
        max-width: 420px;
        margin: 2rem auto;
        padding: 1.5rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.06);
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
  private buttonRendered = false;
  error?: string;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  ngOnInit(): void {
    this.renderButton();
  }

  ngOnDestroy(): void {
    const script = document.getElementById('g_id_onload');
    if (script) {
      script.remove();
    }
  }

  private renderButton(): void {
    if (this.buttonRendered || !(window as any).google?.accounts?.id) {
      return;
    }

    this.buttonRendered = true;
    this.auth.renderGoogleButton('g_id_signin', (err) => (this.error = err));
  }
}
