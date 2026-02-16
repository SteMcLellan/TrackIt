import { describe, expect, it } from 'vitest';
import { medicationDaypartFromLocalTime } from '../../src/shared/timeline/daypart';

describe('medicationDaypartFromLocalTime', () => {
  it('returns Morning for 03:00', () => {
    expect(medicationDaypartFromLocalTime('03:00')).toBe('Morning');
  });

  it('returns Morning for 10:59', () => {
    expect(medicationDaypartFromLocalTime('10:59')).toBe('Morning');
  });

  it('returns Midday for 11:00', () => {
    expect(medicationDaypartFromLocalTime('11:00')).toBe('Midday');
  });

  it('returns Midday for 13:59', () => {
    expect(medicationDaypartFromLocalTime('13:59')).toBe('Midday');
  });

  it('returns Afternoon for 14:00', () => {
    expect(medicationDaypartFromLocalTime('14:00')).toBe('Afternoon');
  });

  it('returns Afternoon for 17:59', () => {
    expect(medicationDaypartFromLocalTime('17:59')).toBe('Afternoon');
  });

  it('returns Evening for 18:00', () => {
    expect(medicationDaypartFromLocalTime('18:00')).toBe('Evening');
  });

  it('returns Evening for 23:59', () => {
    expect(medicationDaypartFromLocalTime('23:59')).toBe('Evening');
  });

  it('returns Evening for 00:00', () => {
    expect(medicationDaypartFromLocalTime('00:00')).toBe('Evening');
  });

  it('returns Evening for 02:59', () => {
    expect(medicationDaypartFromLocalTime('02:59')).toBe('Evening');
  });

  it('returns null for invalid format', () => {
    expect(medicationDaypartFromLocalTime('9:00')).toBeNull();
    expect(medicationDaypartFromLocalTime('09:00:00')).toBeNull();
    expect(medicationDaypartFromLocalTime('abc')).toBeNull();
    expect(medicationDaypartFromLocalTime('')).toBeNull();
  });

  it('returns null for out-of-range values', () => {
    expect(medicationDaypartFromLocalTime('25:00')).toBeNull();
    expect(medicationDaypartFromLocalTime('12:61')).toBeNull();
  });
});
