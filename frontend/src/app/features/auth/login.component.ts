import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { CardComponent } from '../../shared/ui/card/card.component';

@Component({
    selector: 'app-login',
    imports: [CardComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <app-card style="max-width: 420px; margin: 2rem auto;">
      <p class="app-title">TrackIt — ADHD Symptoms</p>
      <h1>Sign in as a Parent</h1>
      <p>Use your Google account to access your child's TrackIt dashboard.</p>
      <div id="g_id_signin"></div>
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
