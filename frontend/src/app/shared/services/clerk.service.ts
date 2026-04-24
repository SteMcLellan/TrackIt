import { Injectable, computed, signal } from '@angular/core';
import { Clerk } from '@clerk/clerk-js';
import { environment } from '../../../environments/environment';

type ClerkLoadOptions = NonNullable<Parameters<Clerk['load']>[0]>;
type ClerkUIConstructor = NonNullable<NonNullable<ClerkLoadOptions['ui']>['ClerkUI']>;

declare global {
  interface Window {
    __internal_ClerkUICtor?: ClerkUIConstructor;
  }
}

interface ClerkState {
  error: string | null;
  initialized: boolean;
  isSignedIn: boolean;
  sessionId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userPicture: string | null;
}

const initialState: ClerkState = {
  error: null,
  initialized: false,
  isSignedIn: false,
  sessionId: null,
  userId: null,
  userName: null,
  userEmail: null,
  userPicture: null
};

@Injectable({ providedIn: 'root' })
export class ClerkService {
  private clerk: Clerk | null = null;
  private initializePromise: Promise<void> | null = null;
  private readonly state = signal<ClerkState>(initialState);

  readonly error = computed(() => this.state().error);
  readonly initialized = computed(() => this.state().initialized);
  readonly isSignedIn = computed(() => this.state().isSignedIn);
  readonly sessionId = computed(() => this.state().sessionId);
  readonly userId = computed(() => this.state().userId);
  readonly userName = computed(() => this.state().userName);
  readonly userEmail = computed(() => this.state().userEmail);
  readonly userPicture = computed(() => this.state().userPicture);

  initialize(): Promise<void> {
    if (!this.initializePromise) {
      this.initializePromise = this.loadClerk();
    }

    return this.initializePromise;
  }

  async mountSignIn(containerId: string, returnUrl: string | null): Promise<void> {
    await this.initialize();

    const clerk = this.requireClerk();
    const node = document.getElementById(containerId);
    if (!(node instanceof HTMLDivElement)) {
      throw new Error(`Missing Clerk sign-in mount node: ${containerId}`);
    }

    const redirectUrl = this.buildLoginUrl(returnUrl);
    clerk.mountSignIn(node, {
      fallbackRedirectUrl: redirectUrl,
      forceRedirectUrl: redirectUrl
    });
  }

  unmountSignIn(containerId: string): void {
    if (!this.clerk) {
      return;
    }

    const node = document.getElementById(containerId);
    if (node instanceof HTMLDivElement) {
      this.clerk.unmountSignIn(node);
    }
  }

  async getSessionToken(): Promise<string | null> {
    await this.initialize();
    return this.clerk?.session ? this.clerk.session.getToken() : null;
  }

  async signOut(): Promise<void> {
    await this.initialize();
    if (!this.clerk?.isSignedIn) {
      return;
    }

    await this.clerk.signOut({ redirectUrl: this.buildLoginUrl(null) });
  }

  private async loadClerk(): Promise<void> {
    const publishableKey = environment.clerkPublishableKey.trim();
    if (!publishableKey) {
      this.reportInitializationFailure(
        'Authentication is unavailable. Configure `clerkPublishableKey` in the frontend environment and reload.',
        new Error('Clerk publishable key is not configured.')
      );
      return;
    }

    try {
      await this.loadClerkUi(publishableKey);
      const clerk = new Clerk(publishableKey);
      await clerk.load({
        ui: { ClerkUI: window.__internal_ClerkUICtor }
      });

      this.clerk = clerk;
      this.updateStateFromClerk();
      clerk.addListener(() => this.updateStateFromClerk());
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown Clerk startup error.';
      this.reportInitializationFailure(
        `Authentication is unavailable. Clerk failed to initialize. Check the Clerk configuration and reload. Details: ${detail}`,
        error
      );
    }
  }

  private loadClerkUi(publishableKey: string): Promise<void> {
    if (window.__internal_ClerkUICtor) {
      return Promise.resolve();
    }

    const clerkDomain = this.getClerkFrontendApiDomain(publishableKey);

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        if (window.__internal_ClerkUICtor) {
          resolve();
          return;
        }

        reject(new Error('Clerk UI bundle loaded without exposing its constructor.'));
      };
      script.onerror = () => reject(new Error('Failed to load @clerk/ui bundle.'));
      document.head.appendChild(script);
    });
  }

  private getClerkFrontendApiDomain(publishableKey: string): string {
    const encodedDomain = publishableKey.split('_')[2];
    if (!encodedDomain) {
      throw new Error('Clerk publishable key is not valid.');
    }

    return atob(encodedDomain).slice(0, -1);
  }

  private updateStateFromClerk(): void {
    const user = this.clerk?.user;
    this.state.set({
      error: null,
      initialized: true,
      isSignedIn: !!this.clerk?.isSignedIn,
      sessionId: this.clerk?.session?.id ?? null,
      userId: user?.id ?? null,
      userName: user?.fullName ?? user?.firstName ?? null,
      userEmail: user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null,
      userPicture: user?.imageUrl || null
    });
  }

  private buildLoginUrl(returnUrl: string | null): string {
    if (!returnUrl) {
      return '/login';
    }

    const params = new URLSearchParams({ returnUrl });
    return `/login?${params.toString()}`;
  }

  private requireClerk(): Clerk {
    if (this.clerk) {
      return this.clerk;
    }

    throw new Error(this.state().error ?? 'Clerk failed to initialize.');
  }

  private reportInitializationFailure(message: string, error: unknown): void {
    console.error('[ClerkService] Failed to initialize Clerk authentication:', error);
    this.clerk = null;
    this.state.set({
      ...initialState,
      error: message,
      initialized: true
    });
  }
}
