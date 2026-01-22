import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-icon-medications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
      <path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 1 1 7-7l7 7a4.95 4.95 0 0 1-7 7z"/>
      <path d="M8.5 8.5l7 7"/>
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; }
    svg { width: 1em; height: 1em; }
  `]
})
export class MedicationsIconComponent {}
