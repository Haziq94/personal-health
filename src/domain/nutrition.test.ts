import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MACRO_SPLIT,
  addMacros,
  basalMetabolicRate,
  calorieTarget,
  entryTotal,
  kcalFromMacros,
  macroTargets,
  scaleMacros,
  sumEntries,
  totalDailyEnergyExpenditure,
} from '@/domain/nutrition';
import type { FoodEntry, Macros, Profile } from '@/domain/types';

const NOW = new Date(2026, 0, 15, 12).getTime();

const profile: Profile = {
  heightCm: 180,
  birthYear: 1996, // age 30 at NOW
  sex: 'male',
  activityLevel: 'moderate',
};

const rice: Macros = { kcal: 200, proteinG: 4, carbsG: 44, fatG: 0.5 };

function entry(overrides: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: 'e1',
    foodId: 'f1',
    name: 'Rice',
    loggedAt: NOW,
    meal: 'lunch',
    servings: 1,
    perServing: rice,
    ...overrides,
  };
}

describe('macro arithmetic', () => {
  it('scales every field', () => {
    expect(scaleMacros(rice, 2)).toEqual({ kcal: 400, proteinG: 8, carbsG: 88, fatG: 1 });
  });

  it('adds field-wise', () => {
    expect(addMacros(rice, rice)).toEqual(scaleMacros(rice, 2));
  });

  it('multiplies the snapshot by servings', () => {
    expect(entryTotal(entry({ servings: 1.5 })).kcal).toBe(300);
  });

  it('sums a day of entries', () => {
    const total = sumEntries([entry(), entry({ id: 'e2', servings: 2 })]);
    expect(total.kcal).toBe(600);
    expect(total.carbsG).toBe(132);
  });

  it('sums to zero for an empty day', () => {
    expect(sumEntries([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('derives calories from macros for sanity checks', () => {
    expect(kcalFromMacros({ kcal: 0, proteinG: 10, carbsG: 20, fatG: 5 })).toBe(165);
  });
});

describe('energy expenditure', () => {
  it('computes Mifflin-St Jeor for men', () => {
    // 10*80 + 6.25*180 - 5*30 + 5
    expect(basalMetabolicRate(profile, 80, NOW)).toBe(1780);
  });

  it('computes Mifflin-St Jeor for women', () => {
    expect(basalMetabolicRate({ ...profile, sex: 'female' }, 80, NOW)).toBe(1614);
  });

  it('scales BMR by activity level', () => {
    expect(totalDailyEnergyExpenditure(profile, 80, NOW)).toBeCloseTo(2759, 6);
  });
});

describe('calorie target', () => {
  it('applies a deficit for a loss goal', () => {
    // 2759 - (0.5 * 7700 / 7) = 2759 - 550
    expect(calorieTarget(profile, 80, -0.5, NOW)).toBe(2209);
  });

  it('applies a surplus for a gain goal', () => {
    expect(calorieTarget(profile, 80, 0.25, NOW)).toBe(3034);
  });

  it('never prescribes a target below BMR', () => {
    expect(calorieTarget(profile, 80, -3, NOW)).toBe(1780);
  });
});

describe('macro targets', () => {
  it('splits calories into grams that add back up', () => {
    const targets = macroTargets(2000, DEFAULT_MACRO_SPLIT);
    expect(kcalFromMacros(targets)).toBeCloseTo(2000, 6);
    expect(targets.proteinG).toBeCloseTo(150, 6);
    expect(targets.fatG).toBeCloseTo(66.667, 3);
  });

  it('rejects a split that does not sum to 1', () => {
    expect(() => macroTargets(2000, { protein: 0.5, carbs: 0.4, fat: 0.3 })).toThrow();
  });
});
