import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/40de48a457ef43beab1f50b6742a7664
 * @stitch-screen-title TrackIt Trendline Logo Identity
 * @stitch-status converted
 * @stitch-last-sync 2026-02-11
 */
@Component({
  selector: 'app-icon-trackit-trendline-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
      <path
        d="M40 95 C 70 65, 100 125, 120 85 C 140 45, 170 105, 200 75"
        fill="none"
        stroke="var(--color-vital-emerald, #10b981)"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M40 120 C 70 90, 100 150, 120 110 C 140 70, 170 130, 200 100"
        fill="none"
        stroke="var(--color-electric-violet, #8b5cf6)"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M40 145 C 70 115, 100 175, 120 135 C 140 95, 170 155, 200 125"
        fill="none"
        stroke="var(--color-energetic-amber, #f59e0b)"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      svg {
        width: 100%;
        height: auto;
      }
    `
  ]
})
export class TrackItTrendlineLogoIconComponent {}
