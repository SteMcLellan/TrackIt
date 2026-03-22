export type ParticipantRole = 'manager' | 'viewer';

export type Participant = {
  id: string;
  displayName?: string;
  birthDate?: string;
  ageYears: number | null;
  createdAtUtc: string;
  createdByUserId: string;
  role: ParticipantRole;
};
