import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-insights-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="placeholder">
      <p class="eyebrow">Insights</p>
      <h1>Redesign in Progress</h1>
      <p class="copy">
        The new Insights experience is being migrated from Stitch. This shell route is now active and ready for the
        redesigned screen.
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
      max-width: 32ch;
    }
  `]
})
export class InsightsPlaceholderComponent {}
