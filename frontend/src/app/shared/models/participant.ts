export type ParticipantRole = 'manager' | 'viewer';

export type Participant = {
  id: string;
  displayName?: string;
  ageYears: number;
  createdAt: string;
  createdByUserId: string;
  role: ParticipantRole;
};
