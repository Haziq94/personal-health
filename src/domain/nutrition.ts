/** Macro arithmetic and calorie targets. */

import type {
  ActivityLevel,
  FoodEntry,
  Macros,
  Profile,
} from '@/domain/types';
import { ZERO_MACROS } from '@/domain/types';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Energy in roughly 1 kg of body fat, used to turn a rate goal into a deficit. */
export const KCAL_PER_KG_FAT = 7700;

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export function scaleMacros(macros: Macros, factor: number): Macros {
  return {
    kcal: macros.kcal * factor,
    proteinG: macros.proteinG * factor,
    carbsG: macros.carbsG * factor,
    fatG: macros.fatG * factor,
  };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}

export function subtractMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal - b.kcal,
    proteinG: a.proteinG - b.proteinG,
    carbsG: a.carbsG - b.carbsG,
    fatG: a.fatG - b.fatG,
  };
}

/** Total macros for one logged entry, i.e. its snapshot scaled by servings. */
export function entryTotal(entry: FoodEntry): Macros {
  return scaleMacros(entry.perServing, entry.servings);
}

export function sumEntries(entries: readonly FoodEntry[]): Macros {
  return entries.reduce<Macros>(
    (total, entry) => addMacros(total, entryTotal(entry)),
    ZERO_MACROS,
  );
}

/**
 * Calories implied by a macro breakdown. Useful for sanity-checking a food the
 * user typed in by hand — a large gap usually means a mistyped number.
 */
export function kcalFromMacros(macros: Macros): number {
  return (
    macros.proteinG * KCAL_PER_G.protein +
    macros.carbsG * KCAL_PER_G.carbs +
    macros.fatG * KCAL_PER_G.fat
  );
}

export function ageFrom(birthYear: number, now: number = Date.now()): number {
  return new Date(now).getFullYear() - birthYear;
}

/**
 * Basal metabolic rate, Mifflin-St Jeor. This is the modern default and is
 * meaningfully more accurate than Harris-Benedict for most people.
 */
export function basalMetabolicRate(
  profile: Profile,
  weightKg: number,
  now: number = Date.now(),
): number {
  const base =
    10 * weightKg + 6.25 * profile.heightCm - 5 * ageFrom(profile.birthYear, now);
  return profile.sex === 'male' ? base + 5 : base - 161;
}

/** Total daily energy expenditure: BMR scaled by activity level. */
export function totalDailyEnergyExpenditure(
  profile: Profile,
  weightKg: number,
  now: number = Date.now(),
): number {
  return basalMetabolicRate(profile, weightKg, now) * ACTIVITY_MULTIPLIERS[profile.activityLevel];
}

/**
 * Daily calorie target for a desired rate of change.
 *
 * `rateKgPerWeek` is negative to lose weight. The result is floored at the
 * user's BMR: prescribing a target below basal needs is not something this app
 * should quietly do.
 */
export function calorieTarget(
  profile: Profile,
  weightKg: number,
  rateKgPerWeek: number,
  now: number = Date.now(),
): number {
  const tdee = totalDailyEnergyExpenditure(profile, weightKg, now);
  const dailyAdjustment = (rateKgPerWeek * KCAL_PER_KG_FAT) / 7;
  const floor = basalMetabolicRate(profile, weightKg, now);
  return Math.max(floor, Math.round(tdee + dailyAdjustment));
}

/**
 * Split a calorie target into grams of each macro.
 * Percentages are of total calories and must sum to 1.
 */
export function macroTargets(
  kcal: number,
  split: { protein: number; carbs: number; fat: number },
): Macros {
  const total = split.protein + split.carbs + split.fat;
  if (Math.abs(total - 1) > 0.001) {
    throw new Error(`Macro split must sum to 1, got ${total}`);
  }
  return {
    kcal,
    proteinG: (kcal * split.protein) / KCAL_PER_G.protein,
    carbsG: (kcal * split.carbs) / KCAL_PER_G.carbs,
    fatG: (kcal * split.fat) / KCAL_PER_G.fat,
  };
}

export const DEFAULT_MACRO_SPLIT = { protein: 0.3, carbs: 0.4, fat: 0.3 } as const;
