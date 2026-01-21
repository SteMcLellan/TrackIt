export type BehaviorFunction = 'sensory' | 'tangible' | 'escape' | 'attention';

/**
 * Cosmos DB behavior incident document shape.
 */
export interface BehaviorIncidentDocument {
  id: string;
  participantId: string;
  antecedent: string;
  behavior: string;
  consequence: string;
  occurredAtUtc: string;
  logLocalDate: string;           // YYYY-MM-DD
  logLocalTime: string;           // HH:mm
  logTzOffsetMinutes: number;     // Offset from UTC (-840 to 840)
  place: string;
  function: BehaviorFunction;
  createdAtUtc: string;           // Renamed from createdAt
  updatedAtUtc?: string;          // Renamed from updatedAt
  createdByUserId: string;
}
