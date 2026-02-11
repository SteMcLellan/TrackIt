import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-profile-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="placeholder">
      <p class="eyebrow">Profile</p>
      <h1>Redesign in Progress</h1>
      <p class="copy">
        The new profile and settings experience is being rebuilt. This route is reserved as the canonical destination
        for account and participant management in the redesigned shell.
      </p>
    </section>
  `,
  styles: [`
    .placeholder {
      width: 100%;
      max-width: 100%;
      padding: var(--space-5, 1.5rem) var(--space-4, 1rem);
      display: grid;
      gap: var(--space-3, 0.75rem);
    }

    .eyebrow {
      margin: 0;
      color: #8b5cf6;
      font-size: var(--font-size-sm, 0.8125rem);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    h1 {
      margin: 0;
      color: #0f172a;
      font-size: 1.5rem;
      line-height: 1.2;
    }

    .copy {
      margin: 0;
      color: #475569;
      font-size: var(--font-size-base, 0.9375rem);
      line-height: 1.5;
      max-width: 36ch;
    }
  `]
})
export class ProfilePlaceholderComponent {}
