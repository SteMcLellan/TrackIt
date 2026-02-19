export type ReflectionDimension = 'mood' | 'focus' | 'energy' | 'sleep';

const DIMENSION_LABELS: Record<ReflectionDimension, [string, string, string, string, string]> = {
  mood:   ['Struggling', 'Irritable', 'Steady',  'Upbeat',    'Thriving'],
  focus:  ['Scattered',  'Drifting',  'Typical', 'Dialed In', 'Locked In'],
  energy: ['Drained',    'Sluggish',  'Level',   'Buzzing',   'Wired'],
  sleep:  ['Rough Night', 'Restless', 'Fine',    'Solid',     'Refreshed']
};

/**
 * Returns a dimension-specific bucket label for a 0-100 score.
 * Boundaries: <=19, <=39, <=59, <=79, else.
 * Source: docs/backlog/daily-reflection-scoring.md
 */
export function reflectionBucketLabel(dimension: ReflectionDimension, score: number): string {
  if (score <= 19) return DIMENSION_LABELS[dimension][0];
  if (score <= 39) return DIMENSION_LABELS[dimension][1];
  if (score <= 59) return DIMENSION_LABELS[dimension][2];
  if (score <= 79) return DIMENSION_LABELS[dimension][3];
  return DIMENSION_LABELS[dimension][4];
}
