/**
 * Weight trend analysis.
 *
 * Day-to-day scale readings swing by a kilo or more on water alone, so nothing
 * here reports a raw reading as a trend. Smoothing first is the whole point.
 */

import { MS_PER_DAY, daysBetween } from '@/domain/dates';
import type { WeightEntry } from '@/domain/types';

export interface TrendPoint {
  loggedAt: number;
  weightKg: number;
  /** Trailing average over the smoothing window, in kg. */
  averageKg: number;
}

/** Sorted oldest-first. Does not mutate the input. */
function sortByTime(entries: readonly WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => a.loggedAt - b.loggedAt);
}

/**
 * Trailing moving average over a time window rather than a fixed number of
 * points, because weigh-ins are irregular: three readings in one week and one
 * in the next should not weigh the same.
 */
export function movingAverage(
  entries: readonly WeightEntry[],
  windowDays = 7,
): TrendPoint[] {
  const sorted = sortByTime(entries);
  const windowMs = windowDays * MS_PER_DAY;
  const points: TrendPoint[] = [];

  let start = 0;
  let sum = 0;

  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i].weightKg;
    // Drop readings that have fallen out of the trailing window.
    while (sorted[i].loggedAt - sorted[start].loggedAt > windowMs) {
      sum -= sorted[start].weightKg;
      start++;
    }
    points.push({
      loggedAt: sorted[i].loggedAt,
      weightKg: sorted[i].weightKg,
      averageKg: sum / (i - start + 1),
    });
  }

  return points;
}

/**
 * Least-squares rate of change in kg per week over the trailing `windowDays`.
 * Returns null when there is not enough spread to fit a line.
 */
export function trendKgPerWeek(
  entries: readonly WeightEntry[],
  windowDays = 28,
): number | null {
  const sorted = sortByTime(entries);
  if (sorted.length < 2) return null;

  const cutoff = sorted[sorted.length - 1].loggedAt - windowDays * MS_PER_DAY;
  const window = sorted.filter((e) => e.loggedAt >= cutoff);
  if (window.length < 2) return null;

  const origin = window[0].loggedAt;
  const xs = window.map((e) => (e.loggedAt - origin) / MS_PER_DAY);
  const ys = window.map((e) => e.weightKg);

  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - meanX;
    numerator += dx * (ys[i] - meanY);
    denominator += dx * dx;
  }

  // All weigh-ins landed at the same instant — no slope is defined.
  if (denominator === 0) return null;

  return (numerator / denominator) * 7;
}

/** The smoothed current weight — what to show as "where you actually are". */
export function currentSmoothedKg(
  entries: readonly WeightEntry[],
  windowDays = 7,
): number | null {
  const points = movingAverage(entries, windowDays);
  return points.length ? points[points.length - 1].averageKg : null;
}

export interface Projection {
  /** Estimated arrival at the target weight. */
  date: number;
  daysAway: number;
  kgPerWeek: number;
}

/**
 * Projects when the target weight is reached at the current trend.
 *
 * Returns null when the trend is flat, moving away from the target, or too
 * noisy to fit — a projection in those cases would be worse than none.
 */
export function projectTarget(
  entries: readonly WeightEntry[],
  targetKg: number,
  options: { trendWindowDays?: number; averageWindowDays?: number } = {},
): Projection | null {
  const { trendWindowDays = 28, averageWindowDays = 7 } = options;

  const kgPerWeek = trendKgPerWeek(entries, trendWindowDays);
  const current = currentSmoothedKg(entries, averageWindowDays);
  if (kgPerWeek === null || current === null || kgPerWeek === 0) return null;

  const remaining = targetKg - current;
  // Already there, or the trend is heading the wrong way.
  if (remaining === 0 || Math.sign(remaining) !== Math.sign(kgPerWeek)) return null;

  const weeks = remaining / kgPerWeek;
  const daysAway = Math.ceil(weeks * 7);
  const latest = sortByTime(entries)[entries.length - 1].loggedAt;

  return { date: latest + daysAway * MS_PER_DAY, daysAway, kgPerWeek };
}

/** Days of logging history, useful for deciding whether a trend is worth showing. */
export function historySpanDays(entries: readonly WeightEntry[]): number {
  if (entries.length < 2) return 0;
  const sorted = sortByTime(entries);
  return daysBetween(sorted[0].loggedAt, sorted[sorted.length - 1].loggedAt);
}
