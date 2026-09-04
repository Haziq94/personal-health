import { describe, expect, it } from 'vitest';

import { MS_PER_DAY, addDays, daysBetween, endOfDay, isSameDay, startOfDay } from '@/domain/dates';

const NOON = new Date(2026, 2, 14, 12, 30, 45, 123).getTime();

describe('day boundaries', () => {
  it('rolls back to local midnight', () => {
    expect(new Date(startOfDay(NOON)).getHours()).toBe(0);
    expect(new Date(startOfDay(NOON)).getDate()).toBe(14);
  });

  it('is idempotent', () => {
    expect(startOfDay(startOfDay(NOON))).toBe(startOfDay(NOON));
  });

  it('gives an exclusive upper bound on the next day', () => {
    expect(new Date(endOfDay(NOON)).getDate()).toBe(15);
    expect(new Date(endOfDay(NOON)).getHours()).toBe(0);
  });

  it('recognises times within the same day', () => {
    expect(isSameDay(NOON, NOON + 1000)).toBe(true);
    expect(isSameDay(NOON, NOON + MS_PER_DAY)).toBe(false);
  });
});

describe('daysBetween', () => {
  it('counts calendar days regardless of time of day', () => {
    const early = new Date(2026, 2, 14, 1).getTime();
    const late = new Date(2026, 2, 16, 23).getTime();
    expect(daysBetween(early, late)).toBe(2);
  });

  it('is zero within one day and negative going backwards', () => {
    expect(daysBetween(NOON, NOON + 3600_000)).toBe(0);
    expect(daysBetween(addDays(NOON, 5), NOON)).toBe(-5);
  });
});
