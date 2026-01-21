export type BehaviorFunction = 'sensory' | 'tangible' | 'escape' | 'attention';

export type BehaviorIncident = {
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
};
