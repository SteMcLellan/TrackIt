export interface ParticipantInviteDocument {
  id: string;
  participantId: string;
  createdAtUtc: string;
  createdByUserId: string;
  expiresAtUtc: string;
  revokedAtUtc?: string;
  revokedByUserId?: string;
  consumedAtUtc?: string;
  consumedByUserId?: string;
}
