import { describe, expect, it } from 'vitest';
import { reflectionBucketLabel, ReflectionDimension } from '../../src/shared/timeline/reflection-labels';

describe('reflectionBucketLabel', () => {
  const expected: Record<ReflectionDimension, [string, string, string, string, string]> = {
    mood:   ['Struggling', 'Irritable', 'Steady',  'Upbeat',    'Thriving'],
    focus:  ['Scattered',  'Drifting',  'Typical', 'Dialed In', 'Locked In'],
    energy: ['Drained',    'Sluggish',  'Level',   'Buzzing',   'Wired'],
    sleep:  ['Rough Night', 'Restless', 'Fine',    'Solid',     'Refreshed']
  };

  const boundaries = [
    { score: 0,   bucket: 0 },
    { score: 19,  bucket: 0 },
    { score: 20,  bucket: 1 },
    { score: 39,  bucket: 1 },
    { score: 40,  bucket: 2 },
    { score: 59,  bucket: 2 },
    { score: 60,  bucket: 3 },
    { score: 79,  bucket: 3 },
    { score: 80,  bucket: 4 },
    { score: 100, bucket: 4 }
  ];

  for (const dimension of ['mood', 'focus', 'energy', 'sleep'] as ReflectionDimension[]) {
    describe(dimension, () => {
      for (const { score, bucket } of boundaries) {
        it(`returns "${expected[dimension][bucket]}" for score ${score}`, () => {
          expect(reflectionBucketLabel(dimension, score)).toBe(expected[dimension][bucket]);
        });
      }
    });
  }
});
