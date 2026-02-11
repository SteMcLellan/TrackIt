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
import { CloseIconComponent } from '../icons';

/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/1c1459bdb1724f6ca337ae399d9022a1
 * @stitch-screen-title Profile
 * @stitch-status converted
 * @stitch-last-sync 2026-02-11
 */
@Component({
  selector: 'app-bottom-sheet',
  imports: [CloseIconComponent],
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
        <div class="drag-zone" (pointerdown)="onHandleDown($event)">
          <div class="handle-area">
            <div class="handle"></div>
          </div>
          @if (title()) {
            <div class="header">
              <h3 class="title">{{ title() }}</h3>
              <button type="button" class="close-btn" (click)="close(); $event.stopPropagation()" aria-label="Close">
                <app-icon-close class="close-icon" />
              </button>
            </div>
          }
        </div>
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
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
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
      border-radius: 2.5rem 2.5rem 0 0;
      box-shadow: 0 -12px 32px rgba(15, 23, 42, 0.22);
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
    .drag-zone {
      position: relative;
      flex-shrink: 0;
      cursor: grab;
      touch-action: none;
    }
    .drag-zone:active {
      cursor: grabbing;
    }
    .handle-area {
      display: flex;
      justify-content: center;
      padding: 0.75rem 1.5rem 0;
    }
    .handle {
      width: 40px;
      height: 4px;
      background: #e2e8f0;
      border-radius: 999px;
      margin-bottom: 1.5rem;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding: 0 1.5rem 0.75rem;
      flex-shrink: 0;
    }
    .title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #0f172a;
    }
    .close-btn {
      position: absolute;
      top: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      background: #f8fafc;
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
    .close-icon {
      font-size: 20px;
    }
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 0 1.5rem 3rem;
      overscroll-behavior: contain;
    }
    @media (min-width: 640px) {
      .sheet {
        left: 50%;
        right: auto;
        transform: translateX(-50%) translateY(100%);
        width: 100%;
        max-width: 480px;
        border-radius: 2.5rem;
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
