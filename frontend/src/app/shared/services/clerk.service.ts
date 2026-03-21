import { Injectable, computed, signal } from '@angular/core';
import { Clerk } from '@clerk/clerk-js';
import { environment } from '../../../environments/environment';

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
      const clerk = new Clerk(publishableKey);
      await clerk.load();

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
