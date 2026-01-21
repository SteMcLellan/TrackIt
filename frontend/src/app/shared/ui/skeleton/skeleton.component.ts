import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Skeleton loader component for displaying loading placeholders.
 * Uses shimmer animation defined in global styles.css.
 *
 * @example
 * <app-skeleton width="100%" height="1rem" />
 * <app-skeleton variant="circle" width="40px" />
 * <app-skeleton variant="card" />
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="skeleton"
      [class.skeleton-text]="variant() === 'text'"
      [class.skeleton-circle]="variant() === 'circle'"
      [class.skeleton-card]="variant() === 'card'"
      [class.skeleton-button]="variant() === 'button'"
      [style.width]="width()"
      [style.height]="height()"
      [style.borderRadius]="radius()"
      aria-hidden="true"
    ></div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .skeleton {
      background: linear-gradient(
        90deg,
        #e2e8f0 25%,
        #f1f5f9 50%,
        #e2e8f0 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .skeleton-text {
      height: 1em;
      border-radius: var(--radius-1, 0.25rem);
    }

    .skeleton-circle {
      border-radius: 50%;
    }

    .skeleton-card {
      height: 120px;
      border-radius: var(--radius-2, 0.5rem);
    }

    .skeleton-button {
      height: 44px;
      border-radius: var(--radius-2, 0.5rem);
    }
  `]
})
export class SkeletonComponent {
  readonly variant = input<'text' | 'circle' | 'card' | 'button' | 'custom'>('text');
  readonly width = input<string>('100%');
  readonly height = input<string | undefined>(undefined);
  readonly radius = input<string | undefined>(undefined);
}
