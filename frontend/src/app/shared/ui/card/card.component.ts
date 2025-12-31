import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Simple content container with consistent padding and border styling.
 */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content></ng-content>
  `,
  styles: [
    `
      :host {
        display: block;
        background: #fff;
        padding: 1.5rem;
        border-radius: 0.5rem;
        border: 1px solid #e2e8f0;
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.06);
      }
    `
  ]
})
export class CardComponent {}
