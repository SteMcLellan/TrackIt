export type ReflectionFacet = 'mood' | 'focus' | 'energy' | 'sleep';

export type ReflectionChip = {
  label: string;
  colorClass: string;
};

const FACET_COLOR_CLASS: Record<ReflectionFacet, string> = {
  mood: 'chip-violet',
  focus: 'chip-emerald',
  energy: 'chip-amber',
  sleep: 'chip-sky'
};

const KNOWN_LABELS: Record<ReflectionFacet, string[]> = {
  mood:   ['struggling', 'irritable', 'steady', 'upbeat', 'thriving'],
  focus:  ['scattered', 'drifting', 'typical', 'dialed_in', 'locked_in'],
  energy: ['drained', 'sluggish', 'steady', 'buzzing', 'wired'],
  sleep:  ['rough_night', 'restless', 'fine', 'solid', 'refreshed']
};

/** Maps old generic bands to the corresponding index in the dimension-specific label array. */
const LEGACY_BAND_INDEX: Record<string, number> = {
  very_low: 0,
  low: 1,
  medium: 2,
  high: 3
};

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolves a reflection tag value to a display chip with label and color class.
 * Handles both new dimension-specific labels (e.g. "steady") and legacy generic
 * bands (e.g. "medium") for backwards compatibility with projectionVersion 1.
 */
export function resolveReflectionChip(facet: ReflectionFacet, tagValue: string): ReflectionChip {
  const colorClass = FACET_COLOR_CLASS[facet];
  const normalized = tagValue.toLowerCase();

  // New dimension-specific label
  if (KNOWN_LABELS[facet].includes(normalized)) {
    return { label: titleCase(normalized), colorClass };
  }

  // Legacy generic band — map to dimension-specific label
  const legacyIndex = LEGACY_BAND_INDEX[normalized];
  if (legacyIndex !== undefined) {
    return { label: titleCase(KNOWN_LABELS[facet][legacyIndex]), colorClass };
  }

  // Unknown value — display as-is with title case
  return { label: titleCase(normalized), colorClass };
}
