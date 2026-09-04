import type { MealType } from '@/domain/types';

/**
 * The meal a log at this time of day most likely belongs to.
 *
 * Used to pre-select the meal when quick-adding, so the common case takes no
 * taps. The small hours count as a snack rather than an early breakfast: food
 * logged at 1am is nearly always the end of the previous evening.
 */
export function defaultMealFor(ms: number = Date.now()): MealType {
  const hour = new Date(ms).getHours();
  if (hour < 4) return 'snack';
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}
