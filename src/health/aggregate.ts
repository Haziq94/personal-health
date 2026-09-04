import { startOfDay } from '@/domain/dates';
import type { DailySteps } from '@/health/types';

export interface StepSample {
  /** Start of the bucket the platform reported. */
  start: number;
  steps: number;
}

/**
 * Folds platform buckets into local days.
 *
 * Both stores can return a bucket per day already, but they bucket in their own
 * way and can hand back partial or duplicate windows. Re-bucketing on local
 * midnight here keeps steps aligned with how the rest of the app splits days,
 * and is testable without a device.
 *
 * Days with no steps are dropped rather than reported as zero — "no data" and
 * "you did not move" are different claims.
 */
export function toDailySteps(samples: readonly StepSample[]): DailySteps[] {
  const byDay = new Map<number, number>();

  for (const sample of samples) {
    if (!Number.isFinite(sample.steps) || sample.steps <= 0) continue;

    const day = startOfDay(sample.start);
    byDay.set(day, (byDay.get(day) ?? 0) + sample.steps);
  }

  return [...byDay.entries()]
    .map(([day, steps]) => ({ day, steps: Math.round(steps) }))
    .sort((a, b) => a.day - b.day);
}

/** Steps for one local day, or null when the platform reported nothing. */
export function stepsForDay(
  daily: readonly DailySteps[],
  dayMs: number,
): number | null {
  const day = startOfDay(dayMs);
  return daily.find((entry) => entry.day === day)?.steps ?? null;
}
