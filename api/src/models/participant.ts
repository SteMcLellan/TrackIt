/**
 * Cosmos DB participant document shape.
 */
export interface ParticipantDocument {
  id: string;
  displayName?: string;
  birthDate?: string; // YYYY-MM-DD
  ageYears?: number | null;
  createdAtUtc: string;
  createdByUserId: string;
}

/**
 * Cosmos DB user-participant link document shape.
 */
export interface UserParticipantLinkDocument {
  id: string;
  userId: string;
  participantId: string;
  role: 'manager' | 'viewer';
  createdAtUtc: string;
}
