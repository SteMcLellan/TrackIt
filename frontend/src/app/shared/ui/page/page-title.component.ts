import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Page-level title component with optional subtitle.
 * Used for consistent h1 headers across feature pages.
 */
@Component({
  selector: 'app-page-title',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header">
      <h1>{{ title() }}</h1>
      @if (subtitle()) {
        <p class="subtitle">{{ subtitle() }}</p>
      }
    </div>
  `,
  styles: [`
    .header {
      display: grid;
      gap: var(--space-1);
    }

    h1 {
      margin: 0;
      font-size: var(--font-size-xl);
      font-weight: 600;
      color: var(--color-gray-900);
    }

    .subtitle {
      margin: 0;
      color: var(--color-gray-600);
      font-size: var(--font-size-sm);
    }
  `]
})
export class PageTitleComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
