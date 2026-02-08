import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-icon-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
      <line x1="3" y1="12" x2="21" y2="12"/>
      <circle cx="8" cy="12" r="2"/>
      <circle cx="16" cy="12" r="2"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; }
    svg { width: 1em; height: 1em; }
  `]
})
export class TimelineIconComponent {}
