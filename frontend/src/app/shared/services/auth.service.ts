import { Injectable, computed, inject } from '@angular/core';
import { ClerkService } from './clerk.service';
import { ParticipantService } from './participant.service';

interface AppUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

const signedOutUser: AppUser = {
  sub: '',
  email: '',
  name: '',
  picture: undefined
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly clerk = inject(ClerkService);
  private readonly participants = inject(ParticipantService);

  readonly isAuthenticated = computed(() => !!this.clerk.sessionId());

  readonly appUser = computed<AppUser>(() => {
    const userId = this.clerk.userId();
    if (!userId) {
      return signedOutUser;
    }
    return {
      sub: userId,
      email: this.clerk.userEmail() ?? '',
      name: this.clerk.userName() ?? '',
      picture: this.clerk.userPicture() ?? undefined
    };
  });

  async signOut(): Promise<void> {
    this.logout();
    try {
      await this.clerk.signOut();
    } catch (err) {
      console.error('[AuthService] Clerk sign-out failed:', err);
    }
  }

  logout(): void {
    this.participants.clearActiveParticipant();
    localStorage.removeItem('trackit.appUser');
  }
}
