import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClerkService } from './clerk.service';
import { ParticipantService } from './participant.service';

interface AppUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  roles?: string[];
  token: string;
}

const signedOutUser: AppUser = {
  sub: '',
  email: 'signed-out@trackit.local',
  name: 'Signed out',
  picture: undefined,
  role: 'guest',
  roles: ['guest'],
  token: ''
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'trackit.appUser';
  private readonly http = inject(HttpClient);
  private readonly clerk = inject(ClerkService);
  private readonly participants = inject(ParticipantService);
  private readonly appUserState = signal<AppUser>(signedOutUser);
  private logoutTimerId: number | null = null;
  private syncInFlightForSessionId: string | null = null;

  readonly appUser = this.appUserState.asReadonly();
  readonly isAuthenticated = computed(() => this.isTokenValid(this.appUserState().token));

  constructor() {
    this.appUserState.set(this.readStoredUser());

    effect(() => {
      this.scheduleTokenExpiry(this.appUserState().token);
    });

    effect(() => {
      const initialized = this.clerk.initialized();
      const clerkError = this.clerk.error();
      const sessionId = this.clerk.sessionId();
      const clerkUserId = this.clerk.userId();
      const appUser = this.appUserState();

      if (!initialized || clerkError) {
        return;
      }

      if (!sessionId || !clerkUserId) {
        if (appUser.token) {
          this.logout();
        }
        this.syncInFlightForSessionId = null;
        return;
      }

      if (this.isTokenValid(appUser.token) && appUser.sub === clerkUserId) {
        return;
      }

      if (this.syncInFlightForSessionId === sessionId) {
        return;
      }

      void this.exchangeClerkSession(sessionId);
    });
  }

  async signOut(): Promise<void> {
    try {
      await this.clerk.signOut();
    } catch (err) {
      console.error('[AuthService] Clerk sign-out failed:', err);
    } finally {
      this.logout();
    }
  }

  logout(): void {
    this.appUserState.set(signedOutUser);
    this.participants.clearActiveParticipant();
    localStorage.removeItem(this.storageKey);
    this.clearLogoutTimer();
  }

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

  private persistUser(user: AppUser): void {
    if (!user?.token || !this.isTokenValid(user.token)) {
      this.logout();
      return;
    }

    this.appUserState.set(user);
    localStorage.setItem(this.storageKey, JSON.stringify(user));
  }

  private isTokenValid(token: string): boolean {
    const exp = this.readJwtExp(token);
    if (!exp) {
      return false;
    }

    return Date.now() < exp * 1000;
  }

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

  private scheduleTokenExpiry(token: string): void {
    this.clearLogoutTimer();
    const exp = this.readJwtExp(token);
    if (!exp || typeof window === 'undefined') {
      return;
    }

    const msUntilExpiry = exp * 1000 - Date.now();
    if (msUntilExpiry <= 0) {
      this.logout();
      return;
    }

    this.logoutTimerId = window.setTimeout(() => this.logout(), msUntilExpiry);
  }

  private clearLogoutTimer(): void {
    if (this.logoutTimerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.logoutTimerId);
      this.logoutTimerId = null;
    }
  }

  private async exchangeClerkSession(sessionId: string): Promise<void> {
    this.syncInFlightForSessionId = sessionId;

    try {
      const sessionToken = await this.clerk.getSessionToken();
      if (!sessionToken) {
        if (this.clerk.sessionId() === sessionId) {
          this.logout();
        }
        return;
      }

      const user = await firstValueFrom(
        this.http.post<AppUser>(`${environment.apiBaseUrl}/auth/login`, { sessionToken })
      );

      if (this.clerk.sessionId() !== sessionId) {
        return;
      }

      this.persistUser(user);
    } catch (error) {
      console.error('[AuthService] Failed to exchange Clerk session token:', error);
      if (this.clerk.sessionId() === sessionId) {
        this.logout();
      }
    } finally {
      if (this.syncInFlightForSessionId === sessionId) {
        this.syncInFlightForSessionId = null;
      }
    }
  }
}
