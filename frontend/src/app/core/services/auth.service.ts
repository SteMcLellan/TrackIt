import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface AppUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  role?: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly appUserSubject = new BehaviorSubject<AppUser | null>(null);
  readonly appUser$ = this.appUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  get appUserSnapshot(): AppUser | null {
    return this.appUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.appUserSubject.value?.token;
  }

  renderGoogleButton(containerId: string, onError: (msg: string) => void): void {
    const google = (window as any).google;
    if (!google?.accounts?.id) {
      onError('Google Identity Services failed to load.');
      return;
    }

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: any) => this.exchangeGoogleToken(response.credential, onError),
      ux_mode: 'popup'
    });

    google.accounts.id.renderButton(document.getElementById(containerId), {
      type: 'standard',
      theme: 'outline',
      size: 'large'
    });
  }

  logout(): void {
    this.appUserSubject.next(null);
  }

  private exchangeGoogleToken(idToken: string, onError: (msg: string) => void): void {
    this.http
      .post<AppUser>(`${environment.apiBaseUrl}/auth/login`, {}, {
        headers: { Authorization: `Bearer ${idToken}` }
      })
      .pipe(
        tap({
          next: (user) => this.appUserSubject.next(user),
          error: (err) => onError(err?.error?.message || 'Login failed')
        })
      )
      .subscribe();
  }
}
