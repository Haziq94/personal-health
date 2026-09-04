/** Day-bucketing helpers. All timestamps are epoch milliseconds, local time. */

export const MS_PER_DAY = 86_400_000;

/** Midnight at the start of the local day containing `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Midnight at the start of the following local day — an exclusive upper bound. */
export function endOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/**
 * Whole local days from `a` to `b`. Uses calendar midnights rather than raw
 * subtraction so daylight-saving shifts do not produce 0.96- or 1.04-day gaps.
 */
export function daysBetween(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / MS_PER_DAY);
}
