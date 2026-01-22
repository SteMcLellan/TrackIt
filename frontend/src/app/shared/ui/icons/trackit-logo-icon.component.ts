import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-icon-trackit-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7.2 12.6 L10.5 15.9 L16.9 8.6"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="16.8" cy="14.8" r="1.1" fill="currentColor" />
      <circle cx="18.6" cy="13.1" r="0.9" fill="currentColor" />
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      svg {
        width: 24px;
        height: 24px;
      }
    `
  ]
})
export class TrackItLogoIconComponent {}
