import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-icon-arrow-right',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M5 12h12.2l-4.4-4.4 1.4-1.4L21 12l-6.8 6.8-1.4-1.4 4.4-4.4H5z" />
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      svg {
        width: 1.1rem;
        height: 1.1rem;
        fill: currentColor;
      }
    `
  ]
})
export class ArrowRightIconComponent {}
