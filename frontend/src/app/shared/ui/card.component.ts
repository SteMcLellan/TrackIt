import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Simple content container with responsive padding and subtle elevation.
 */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
  styles: [`
    :host {
      display: block;
      background: #fff;
      padding: var(--card-padding, var(--space-4, 1rem));
      border-radius: var(--radius-2, 0.5rem);
      border: 1px solid var(--color-border, #e2e8f0);
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.04));
      transition: box-shadow var(--transition-fast, 120ms ease);
    }

    :host(:hover) {
      box-shadow: var(--shadow-md, 0 2px 8px rgba(0, 0, 0, 0.06));
    }
  `]
})
export class CardComponent {}
