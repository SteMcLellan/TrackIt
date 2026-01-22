import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-icon-chevron-right',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" focusable="false">
      <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; }
    svg { width: 1em; height: 1em; }
  `]
})
export class ChevronRightIconComponent {}
