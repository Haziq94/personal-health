/** Display formatting. Everything here returns a string for the UI layer. */

import type { MealType } from '@/domain/types';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export function mealLabel(meal: MealType): string {
  return MEAL_LABELS[meal];
}

/** Calories are always whole numbers — a decimal implies precision we lack. */
export function formatKcal(kcal: number): string {
  return String(Math.round(kcal));
}

/** One decimal below 10 g, whole numbers above, where the tenth is noise. */
export function formatGrams(grams: number): string {
  return grams < 10 ? grams.toFixed(1) : String(Math.round(grams));
}

/** Drops a trailing ".0" so a single serving reads "1", not "1.0". */
export function formatServings(servings: number): string {
  return Number.isInteger(servings) ? String(servings) : servings.toFixed(2).replace(/0$/, '');
}

/**
 * Parses a number the user typed, accepting a comma as the decimal separator.
 * Returns null for anything that is not a finite number, so callers can tell
 * "empty or invalid" from a genuine zero.
 */
export function parseNumber(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (!trimmed) return null;

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDay(ms: number): string {
  return DAY_FORMAT.format(new Date(ms));
}

export function formatTime(ms: number): string {
  return TIME_FORMAT.format(new Date(ms));
}
