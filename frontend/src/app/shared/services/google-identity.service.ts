import { Injectable, signal } from '@angular/core';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class GoogleIdentityService {
  private readonly MAX_RETRIES = 20;
  private readonly INITIAL_DELAY = 50; // ms
  private readonly MAX_DELAY = 2000; // ms
  private readonly TIMEOUT = 10000; // 10 seconds

  private resolvePromise?: () => void;
  private rejectPromise?: (error: Error) => void;
  private readyPromise: Promise<void>;
  private retryCount = 0;
  private startTime = 0;

  // Reactive signals for component consumption
  readonly isReady = signal(false);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    // Create the promise immediately
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });

    // Start polling automatically
    this.startPolling();
  }

  /**
   * Returns a promise that resolves when Google Identity Services is ready.
   * Components should await this before attempting to use the GIS library.
   */
  waitForGoogleIdentity(): Promise<void> {
    return this.readyPromise;
  }

  private startPolling(): void {
    this.startTime = Date.now();
    this.poll();
  }

  private poll(): void {
    // Check if GIS is available
    if (window.google?.accounts?.id) {
      this.handleSuccess();
      return;
    }

    // Check if we've exceeded the timeout
    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.TIMEOUT) {
      this.handleTimeout();
      return;
    }

    // Check if we've exceeded max retries
    if (this.retryCount >= this.MAX_RETRIES) {
      this.handleMaxRetries();
      return;
    }

    // Schedule next poll with exponential backoff
    const delay = this.calculateDelay();
    this.retryCount++;
    setTimeout(() => this.poll(), delay);
  }

  private calculateDelay(): number {
    // Exponential backoff: INITIAL_DELAY * 2^retryCount, capped at MAX_DELAY
    const exponentialDelay = this.INITIAL_DELAY * Math.pow(2, this.retryCount);
    return Math.min(exponentialDelay, this.MAX_DELAY);
  }

  private handleSuccess(): void {
    this.isReady.set(true);
    this.isLoading.set(false);
    this.error.set(null);
    this.resolvePromise?.();
    console.log('[GoogleIdentityService] GIS library loaded successfully');
  }

  private handleTimeout(): void {
    const errorMessage = 'Unable to load sign-in. Please check your internet connection and try again.';
    this.isReady.set(false);
    this.isLoading.set(false);
    this.error.set(errorMessage);
    this.rejectPromise?.(new Error('Google Identity Services load timeout'));
    console.error('[GoogleIdentityService] Timeout waiting for GIS library');
  }

  private handleMaxRetries(): void {
    const errorMessage = 'Unable to load sign-in. Please refresh the page.';
    this.isReady.set(false);
    this.isLoading.set(false);
    this.error.set(errorMessage);
    this.rejectPromise?.(new Error('Google Identity Services max retries exceeded'));
    console.error('[GoogleIdentityService] Max retries exceeded waiting for GIS library');
  }
}
