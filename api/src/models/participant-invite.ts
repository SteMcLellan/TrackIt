export interface ParticipantInviteDocument {
  id: string;
  participantId: string;
  createdAt: string;
  createdByUserId: string;
  expiresAt: string;
  revokedAt?: string;
  revokedByUserId?: string;
  consumedAt?: string;
  consumedByUserId?: string;
}
