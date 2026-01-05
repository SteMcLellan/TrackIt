export type BehaviorFunction = 'sensory' | 'tangible' | 'escape' | 'attention';

export type BehaviorIncident = {
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
};
