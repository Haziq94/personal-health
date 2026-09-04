import { describe, expect, it } from 'vitest';

import { MS_PER_DAY } from '@/domain/dates';
import type { WeightEntry } from '@/domain/types';
import {
  currentSmoothedKg,
  historySpanDays,
  movingAverage,
  projectTarget,
  trendKgPerWeek,
} from '@/domain/weight';

const BASE = new Date(2026, 0, 1, 12).getTime();

/** Builds entries from [dayOffset, kg] pairs. */
function entries(...points: [number, number][]): WeightEntry[] {
  return points.map(([day, weightKg], i) => ({
    id: `w${i}`,
    loggedAt: BASE + day * MS_PER_DAY,
    weightKg,
    note: null,
  }));
}

describe('movingAverage', () => {
  it('returns nothing for no entries', () => {
    expect(movingAverage([])).toEqual([]);
  });

  it('averages a single reading with itself', () => {
    const [point] = movingAverage(entries([0, 80]));
    expect(point.averageKg).toBe(80);
  });

  it('averages over the trailing window', () => {
    const points = movingAverage(entries([0, 80], [1, 79], [2, 78]), 7);
    expect(points.map((p) => p.averageKg)).toEqual([80, 79.5, 79]);
  });

  it('drops readings that fall outside the window', () => {
    const points = movingAverage(entries([0, 80], [10, 70]), 7);
    expect(points[1].averageKg).toBe(70);
  });

  it('sorts unordered input before smoothing', () => {
    const points = movingAverage(entries([2, 78], [0, 80], [1, 79]), 7);
    expect(points.map((p) => p.weightKg)).toEqual([80, 79, 78]);
  });

  it('keeps the raw reading alongside the average', () => {
    const points = movingAverage(entries([0, 80], [1, 79]), 7);
    expect(points[1].weightKg).toBe(79);
    expect(points[1].averageKg).toBe(79.5);
  });
});

describe('trendKgPerWeek', () => {
  it('is null below two readings', () => {
    expect(trendKgPerWeek([])).toBeNull();
    expect(trendKgPerWeek(entries([0, 80]))).toBeNull();
  });

  it('fits a steady decline', () => {
    const trend = trendKgPerWeek(entries([0, 80], [7, 79.5], [14, 79], [21, 78.5]));
    expect(trend).toBeCloseTo(-0.5, 10);
  });

  it('fits a steady gain', () => {
    const trend = trendKgPerWeek(entries([0, 70], [7, 70.25], [14, 70.5]));
    expect(trend).toBeCloseTo(0.25, 10);
  });

  it('reports a flat trend as zero', () => {
    expect(trendKgPerWeek(entries([0, 80], [7, 80], [14, 80]))).toBeCloseTo(0, 10);
  });

  it('ignores readings older than the window', () => {
    // The 90-day-old reading would otherwise dominate the fit.
    const trend = trendKgPerWeek(entries([-90, 95], [0, 80], [14, 79]), 28);
    expect(trend).toBeCloseTo(-0.5, 10);
  });

  it('is null when every reading shares a timestamp', () => {
    expect(trendKgPerWeek(entries([0, 80], [0, 81]))).toBeNull();
  });
});

describe('currentSmoothedKg', () => {
  it('is null with no history', () => {
    expect(currentSmoothedKg([])).toBeNull();
  });

  it('reports the latest trailing average, not the latest reading', () => {
    // A single high reading should not move the reported figure to 85.
    expect(currentSmoothedKg(entries([0, 79], [1, 85]), 7)).toBe(82);
  });
});

describe('projectTarget', () => {
  const declining = entries([0, 80], [7, 79.5], [14, 79], [21, 78.5]);

  it('projects arrival at the target', () => {
    const projection = projectTarget(declining, 77);
    expect(projection).not.toBeNull();
    expect(projection!.kgPerWeek).toBeCloseTo(-0.5, 10);
    // smoothed current 78.75, 1.75 kg to go at 0.5 kg/week = 24.5 days
    expect(projection!.daysAway).toBe(25);
    expect(projection!.date).toBe(BASE + (21 + 25) * MS_PER_DAY);
  });

  it('is null when the trend moves away from the target', () => {
    expect(projectTarget(declining, 85)).toBeNull();
  });

  it('is null when the trend is flat', () => {
    expect(projectTarget(entries([0, 80], [7, 80], [14, 80]), 75)).toBeNull();
  });

  it('is null without enough history to fit', () => {
    expect(projectTarget(entries([0, 80]), 75)).toBeNull();
  });
});

describe('historySpanDays', () => {
  it('is zero below two readings', () => {
    expect(historySpanDays(entries([0, 80]))).toBe(0);
  });

  it('counts whole days between first and last', () => {
    expect(historySpanDays(entries([0, 80], [30, 78]))).toBe(30);
  });
});
