export type ParticipantInviteResponse = {
  participantId: string;
  inviteId: string;
  expiresAtUtc: string;
};

export type ActiveParticipantInviteResponse = {
  participantId: string;
  inviteId: string | null;
  expiresAtUtc: string | null;
  createdAtUtc: string | null;
};

export type AcceptInviteResponse = {
  participantId: string;
  participantDisplayName?: string;
  alreadyLinked: boolean;
};

export type ParticipantRole = 'manager' | 'viewer';

export type ParticipantMember = {
  userId: string;
  role: ParticipantRole;
  name: string;
  picture?: string;
  isMe: boolean;
  addedAt: string;
};
