/**
 * Core domain types.
 *
 * Two conventions hold everywhere below the UI layer:
 *  - all measurements are metric (kg, ml, cm, g). Conversion happens only at
 *    the display edge, in `units.ts`.
 *  - all timestamps are epoch milliseconds, so they sort and range-query
 *    directly as SQLite INTEGERs.
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: readonly MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
] as const;

/** Nutrition figures. Always "per one serving" unless a name says otherwise. */
export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const ZERO_MACROS: Macros = {
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
};

/** An item in your reusable food library. */
export interface Food {
  id: string;
  name: string;
  brand: string | null;
  /** Human label for one serving, e.g. "1 bowl", "100 g", "1 slice". */
  servingLabel: string;
  /** Weight of one serving, when known. Display/scaling aid only. */
  servingGrams: number | null;
  /** Nutrition for exactly one serving. */
  perServing: Macros;
  isFavorite: boolean;
  createdAt: number;
}

/**
 * A single logged food.
 *
 * `perServing` is a SNAPSHOT taken at log time, deliberately duplicated from
 * the `Food` row. Correcting a food's calories tomorrow must not silently
 * rewrite what today's log says you ate. `foodId` is only a soft link back to
 * the library and may be null for one-off entries.
 */
export interface FoodEntry {
  id: string;
  foodId: string | null;
  /** Denormalized for display, so a deleted library item still reads sensibly. */
  name: string;
  loggedAt: number;
  meal: MealType;
  servings: number;
  perServing: Macros;
}

export interface WeightEntry {
  id: string;
  loggedAt: number;
  weightKg: number;
  note: string | null;
}

export interface WaterEntry {
  id: string;
  loggedAt: number;
  volumeMl: number;
}

/**
 * A daily target. Rows are append-only and selected by `effectiveFrom` so that
 * changing your goal today does not restate whether you hit last week's.
 */
export interface Goal {
  id: string;
  effectiveFrom: number;
  daily: Macros;
  dailyWaterMl: number;
  targetWeightKg: number | null;
  targetDate: number | null;
}

export type Sex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export interface Profile {
  heightCm: number;
  birthYear: number;
  sex: Sex;
  activityLevel: ActivityLevel;
}

export type WeightUnit = 'kg' | 'lb';
export type VolumeUnit = 'ml' | 'floz';
export type HeightUnit = 'cm' | 'in';

export interface UnitPreferences {
  weight: WeightUnit;
  volume: VolumeUnit;
  height: HeightUnit;
}

export const DEFAULT_UNITS: UnitPreferences = {
  weight: 'kg',
  volume: 'ml',
  height: 'cm',
};
