export type ParticipantInviteResponse = {
  participantId: string;
  inviteId: string;
  expiresAt: string;
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
