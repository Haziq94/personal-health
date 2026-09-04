import { describe, expect, it } from 'vitest';

import { MS_PER_DAY, startOfDay } from '@/domain/dates';
import { stepsForDay, toDailySteps } from '@/health/aggregate';

const NOON = new Date(2026, 5, 10, 12).getTime();
const DAY = startOfDay(NOON);

describe('toDailySteps', () => {
  it('returns nothing for no samples', () => {
    expect(toDailySteps([])).toEqual([]);
  });

  it('buckets a sample onto its local day', () => {
    expect(toDailySteps([{ start: NOON, steps: 4200 }])).toEqual([
      { day: DAY, steps: 4200 },
    ]);
  });

  it('sums several buckets landing on the same day', () => {
    const daily = toDailySteps([
      { start: DAY + 1000, steps: 1000 },
      { start: DAY + MS_PER_DAY - 1000, steps: 2500 },
    ]);

    expect(daily).toEqual([{ day: DAY, steps: 3500 }]);
  });

  it('keeps separate days apart and sorts them', () => {
    const daily = toDailySteps([
      { start: NOON + MS_PER_DAY, steps: 800 },
      { start: NOON, steps: 900 },
    ]);

    expect(daily.map((d) => d.steps)).toEqual([900, 800]);
    expect(daily[0].day).toBeLessThan(daily[1].day);
  });

  it('drops empty days rather than reporting a zero', () => {
    // "No data" and "you did not move" are different claims.
    expect(toDailySteps([{ start: NOON, steps: 0 }])).toEqual([]);
  });

  it('ignores non-finite counts from the platform', () => {
    expect(toDailySteps([{ start: NOON, steps: Number.NaN }])).toEqual([]);
    expect(toDailySteps([{ start: NOON, steps: -5 }])).toEqual([]);
  });

  it('rounds fractional counts', () => {
    expect(toDailySteps([{ start: NOON, steps: 1234.6 }])[0].steps).toBe(1235);
  });
});

describe('stepsForDay', () => {
  const daily = toDailySteps([{ start: NOON, steps: 5000 }]);

  it('finds the day regardless of the time passed in', () => {
    expect(stepsForDay(daily, NOON)).toBe(5000);
    expect(stepsForDay(daily, DAY)).toBe(5000);
    expect(stepsForDay(daily, DAY + MS_PER_DAY - 1)).toBe(5000);
  });

  it('is null for a day with no data', () => {
    expect(stepsForDay(daily, NOON + MS_PER_DAY)).toBeNull();
    expect(stepsForDay([], NOON)).toBeNull();
  });
});
