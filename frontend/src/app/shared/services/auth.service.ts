import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface AppUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  token: string;
}

/**
 * Sentinel user used when no authenticated session exists.
 */
const signedOutUser: AppUser = {
  sub: '',
  email: 'signed-out@trackit.local',
  name: 'Signed out',
  picture: undefined,
  role: 'guest',
  token: ''
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'trackit.appUser';
  private readonly googleScriptSrc = 'https://accounts.google.com/gsi/client';
  private readonly http = inject(HttpClient);
  private readonly appUserState = signal<AppUser>(signedOutUser);
  private googleScriptPromise?: Promise<void>;
  readonly appUser = this.appUserState.asReadonly();
  readonly isAuthenticated = computed(() => this.isTokenValid(this.appUserState().token));

  /**
   * Hydrates user state from local storage on startup.
   */
  constructor() {
    const stored = this.readStoredUser();
    this.appUserState.set(stored);
  }

  /**
   * Initializes Google Identity Services and renders the button.
   */
  async renderGoogleButton(containerId: string, onError: (msg: string) => void): Promise<void> {
    try {
      await this.loadGoogleIdentity(onError);
    } catch {
      return;
    }

    const google = (window as any).google;
    if (!google?.accounts?.id) {
      onError('Google Identity Services failed to load.');
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      onError('Unable to render Google sign-in button.');
      return;
    }

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: any) => this.exchangeGoogleToken(response.credential, onError),
      ux_mode: 'popup',
      auto_select: true
    });

    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large'
    });
  }

  /**
   * Clears persisted credentials and resets the user state.
   */
  logout(): void {
    this.appUserState.set(signedOutUser);
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Exchanges a Google ID token for an app-issued JWT.
   */
  private exchangeGoogleToken(idToken: string, onError: (msg: string) => void): void {
    this.http
      .post<AppUser>(`${environment.apiBaseUrl}/auth/login`, { idToken })
      .pipe(
        tap({
          next: (user) => this.persistUser(user),
          error: (err) => onError(err?.error?.message || 'Login failed')
        })
      )
      .subscribe();
  }

  /**
   * Loads a persisted user if the token is present and unexpired.
   */
  private readStoredUser(): AppUser {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return signedOutUser;
    }
    try {
      const parsed = JSON.parse(raw) as AppUser;
      if (!parsed?.token || !this.isTokenValid(parsed.token)) {
        localStorage.removeItem(this.storageKey);
        return signedOutUser;
      }
      return parsed;
    } catch {
      localStorage.removeItem(this.storageKey);
      return signedOutUser;
    }
  }

  /**
   * Persists a validated user and updates the app state.
   */
  private persistUser(user: AppUser): void {
    if (!user?.token || !this.isTokenValid(user.token)) {
      this.logout();
      return;
    }
    this.appUserState.set(user);
    localStorage.setItem(this.storageKey, JSON.stringify(user));
  }

  /**
   * Checks if a JWT has a valid, unexpired exp claim.
   */
  private isTokenValid(token: string): boolean {
    const exp = this.readJwtExp(token);
    if (!exp) {
      return false;
    }
    return Date.now() < exp * 1000;
  }

  /**
   * Reads the exp claim from a JWT payload, or returns null if invalid.
   */
  private readJwtExp(token: string): number | null {
    try {
      const [, payload] = token.split('.');
      if (!payload) {
        return null;
      }
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(normalized);
      const json = JSON.parse(decoded);
      return typeof json.exp === 'number' ? json.exp : null;
    } catch {
      return null;
    }
  }

  /**
   * Ensures the Google Identity Services script is loaded before rendering the button.
   */
  private loadGoogleIdentity(onError: (msg: string) => void): Promise<void> {
    const google = (window as any).google;
    if (google?.accounts?.id) {
      return Promise.resolve();
    }

    if (this.googleScriptPromise) {
      return this.googleScriptPromise;
    }

    this.googleScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${this.googleScriptSrc}"]`
      );
      const script = existingScript ?? document.createElement('script');
      script.src = this.googleScriptSrc;
      script.async = true;
      script.defer = true;
      script.id = 'g_id_onload';

      const cleanup = () => {
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onErrorEvent);
      };

      const onLoad = () => {
        cleanup();
        resolve();
      };

      const onErrorEvent = () => {
        cleanup();
        reject(new Error('Google Identity Services failed to load.'));
      };

      script.addEventListener('load', onLoad);
      script.addEventListener('error', onErrorEvent);

      if (!existingScript) {
        document.head.appendChild(script);
      }
    }).catch((err) => {
      onError('Google Identity Services failed to load.');
      throw err;
    });

    return this.googleScriptPromise;
  }
}
