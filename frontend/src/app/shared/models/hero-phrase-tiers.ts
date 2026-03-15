export type HeroPhrasePair = { headline: string; subtext: string };

export type HeroPhraseTier = {
  id: string;
  condition: 'no-data' | { min: number; max: number };
  phrases: HeroPhrasePair[];
};

export type HeroPhraseTiersDocument = { id: string; tiers: HeroPhraseTier[] };
