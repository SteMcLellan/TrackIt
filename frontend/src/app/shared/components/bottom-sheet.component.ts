import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  ViewChild,
  AfterViewInit,
  OnDestroy
} from '@angular/core';

@Component({
  selector: 'app-bottom-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="backdrop"
        [class.visible]="visible()"
        (click)="onBackdropClick()"
        role="presentation"
      ></div>
      <div
        #sheet
        class="sheet"
        [class.visible]="visible()"
        role="dialog"
        [attr.aria-label]="title()"
        aria-modal="true"
      >
        <div class="handle-area" (pointerdown)="onHandleDown($event)">
          <div class="handle"></div>
        </div>
        @if (title()) {
          <div class="header">
            <h3 class="title">{{ title() }}</h3>
            <button type="button" class="close-btn" (click)="close()" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 5L5 15M5 5l10 10" />
              </svg>
            </button>
          </div>
        }
        <div class="content">
          <ng-content></ng-content>
        </div>
      </div>
    }
  `,
  styles: [`
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 999;
      opacity: 0;
      transition: opacity 200ms ease;
    }
    .backdrop.visible {
      opacity: 1;
    }
    .sheet {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      max-height: 85vh;
      min-height: 200px;
      background: #fff;
      border-radius: 1rem 1rem 0 0;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      transform: translateY(100%);
      transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
      touch-action: none;
    }
    .sheet.visible {
      transform: translateY(0);
    }
    .handle-area {
      display: flex;
      justify-content: center;
      padding: 0.75rem;
      cursor: grab;
      flex-shrink: 0;
    }
    .handle-area:active {
      cursor: grabbing;
    }
    .handle {
      width: 36px;
      height: 5px;
      background: #d1d5db;
      border-radius: 999px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-4, 1rem) var(--space-3, 0.75rem);
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    .title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #0f172a;
    }
    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      color: #64748b;
      cursor: pointer;
      border-radius: var(--radius-full, 999px);
      transition: background var(--transition-fast, 120ms ease),
                  color var(--transition-fast, 120ms ease);
    }
    .close-btn:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    .content {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-4, 1rem);
      overscroll-behavior: contain;
    }
    @media (min-width: 640px) {
      .sheet {
        left: 50%;
        right: auto;
        transform: translateX(-50%) translateY(100%);
        width: 100%;
        max-width: 480px;
        border-radius: 1rem;
        bottom: var(--space-4, 1rem);
      }
      .sheet.visible {
        transform: translateX(-50%) translateY(0);
      }
    }
  `]
})
export class BottomSheetComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sheet') private sheetRef?: ElementRef<HTMLElement>;

  readonly open = input(false);
  readonly title = input('');
  readonly closed = output();

  readonly visible = signal(false);
  private startY = 0;
  private currentY = 0;
  private isDragging = false;

  ngAfterViewInit(): void {
    if (this.open()) {
      requestAnimationFrame(() => this.visible.set(true));
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.close();
    }
  }

  onBackdropClick(): void {
    this.close();
  }

  close(): void {
    this.visible.set(false);
    setTimeout(() => this.closed.emit(), 300);
  }

  onHandleDown(event: PointerEvent): void {
    this.isDragging = true;
    this.startY = event.clientY;
    this.currentY = 0;
    const sheet = this.sheetRef?.nativeElement;
    if (sheet) {
      sheet.style.transition = 'none';
    }
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.isDragging) return;
    const deltaY = event.clientY - this.startY;
    this.currentY = Math.max(0, deltaY);
    const sheet = this.sheetRef?.nativeElement;
    if (sheet) {
      sheet.style.transform = `translateY(${this.currentY}px)`;
    }
  };

  private onPointerUp = (): void => {
    this.isDragging = false;
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);

    const sheet = this.sheetRef?.nativeElement;
    if (sheet) {
      sheet.style.transition = '';
      sheet.style.transform = '';
    }

    if (this.currentY > 100) {
      this.close();
    }
  };

  // Called by parent when open input changes
  ngOnChanges(): void {
    if (this.open()) {
      requestAnimationFrame(() => this.visible.set(true));
    }
  }
}
