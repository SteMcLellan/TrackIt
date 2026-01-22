import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-icon-close',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" focusable="false">
      <path d="M15 5L5 15M5 5l10 10"/>
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; }
    svg { width: 1em; height: 1em; }
  `]
})
export class CloseIconComponent {}
