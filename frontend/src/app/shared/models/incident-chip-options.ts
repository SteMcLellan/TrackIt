/**
 * Chip options for quick incident logging.
 * Based on evidence-based ABC behavior tracking for ADHD/anxiety in children.
 */

export type ChipCategory = {
  label: string;
  chips: string[];
};

export const antecedentChipCategories: ChipCategory[] = [
  {
    label: 'Demands & Tasks',
    chips: [
      'Homework/schoolwork',
      'Asked to do chore',
      'Difficult task given',
      'Independent work'
    ]
  },
  {
    label: 'Transitions & Changes',
    chips: [
      'Activity transition',
      'Told to stop activity',
      'Change in routine',
      'Leaving somewhere fun'
    ]
  },
  {
    label: 'Social & Environmental',
    chips: [
      'Told "no" or "wait"',
      'Sibling conflict',
      'Not getting attention',
      'Loud/overwhelming environment'
    ]
  },
  {
    label: 'Internal States',
    chips: [
      'Hungry or tired',
      'Unstructured time',
      'Novel/unfamiliar situation'
    ]
  }
];

export const behaviorChipCategories: ChipCategory[] = [
  {
    label: 'Emotional Outbursts',
    chips: [
      'Meltdown/tantrum',
      'Crying',
      'Yelling/screaming',
      'Angry outburst'
    ]
  },
  {
    label: 'Physical Actions',
    chips: [
      'Hitting/kicking',
      'Throwing things',
      'Running away',
      'Climbing/jumping unsafely'
    ]
  },
  {
    label: 'Verbal/Social',
    chips: [
      'Said "no"/refused',
      'Verbal defiance',
      'Shut down/withdrew',
      'Lashed out verbally'
    ]
  },
  {
    label: 'Avoidance',
    chips: [
      'Left the room',
      'Hid',
      'Procrastinated',
      'Ignored request'
    ]
  }
];

export const consequenceChipCategories: ChipCategory[] = [
  {
    label: 'De-escalation',
    chips: [
      'Redirected attention',
      'Offered break',
      'Calming strategy used',
      'Gave space/time'
    ]
  },
  {
    label: 'Boundaries',
    chips: [
      'Repeated request',
      'Item/privilege removed',
      'Activity ended',
      'Natural consequence'
    ]
  },
  {
    label: 'Attention',
    chips: [
      'Comforted/reassured',
      'Firm correction',
      'Ignored behavior',
      'Discussed afterward'
    ]
  },
  {
    label: 'Access',
    chips: [
      'Got requested item',
      'Got out of task',
      'Got attention',
      'Continued activity'
    ]
  }
];

export const placeChipOptions: string[] = [
  'Home',
  'School',
  'Car',
  'Store',
  'Restaurant',
  "Relative's house",
  'Outside',
  'Other'
];

// Flat arrays for quick access
export const allAntecedentChips = antecedentChipCategories.flatMap(c => c.chips);
export const allBehaviorChips = behaviorChipCategories.flatMap(c => c.chips);
export const allConsequenceChips = consequenceChipCategories.flatMap(c => c.chips);
