import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-icon-checkmark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" focusable="false">
      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; }
    svg { width: 1em; height: 1em; }
  `]
})
export class CheckmarkIconComponent {}
