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
  place: string;
  function: BehaviorFunction;
  createdAt: string;
  updatedAt?: string;
  createdByUserId: string;
}
