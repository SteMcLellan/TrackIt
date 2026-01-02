/**
 * Cosmos DB participant document shape.
 */
export interface ParticipantDocument {
  id: string;
  displayName?: string;
  ageYears: number;
  createdAt: string;
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
  createdAt: string;
}
