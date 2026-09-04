import { describe, expect, it } from 'vitest';

import { foodEntriesCsv, weightEntriesCsv } from '@/domain/exports';
import type { FoodEntry, Macros, WeightEntry } from '@/domain/types';

const AT = new Date(2026, 5, 10, 13, 5).getTime();
const rice: Macros = { kcal: 200, proteinG: 4, carbsG: 44, fatG: 0.5 };

function entry(overrides: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: 'e1',
    foodId: 'f1',
    name: 'Rice',
    loggedAt: AT,
    meal: 'lunch',
    servings: 1,
    perServing: rice,
    ...overrides,
  };
}

describe('foodEntriesCsv', () => {
  it('writes a header even with no entries', () => {
    expect(foodEntriesCsv([])).toBe(
      'logged_at,meal,food,servings,kcal,protein_g,carbs_g,fat_g',
    );
  });

  it('multiplies the snapshot by servings', () => {
    const [, row] = foodEntriesCsv([entry({ servings: 2 })]).split('\r\n');
    expect(row).toBe('2026-06-10 13:05,lunch,Rice,2,400,8,88,1');
  });

  it('formats the timestamp as local ISO, not UTC', () => {
    const [, row] = foodEntriesCsv([entry()]).split('\r\n');
    expect(row.startsWith('2026-06-10 13:05')).toBe(true);
  });

  it('quotes a food name containing a comma', () => {
    const [, row] = foodEntriesCsv([entry({ name: 'Nasi lemak, special' })]).split('\r\n');
    expect(row).toContain('"Nasi lemak, special"');
  });

  it('rounds away floating-point noise', () => {
    const [, row] = foodEntriesCsv([
      entry({ servings: 3, perServing: { ...rice, fatG: 0.1 } }),
    ]).split('\r\n');

    // 0.1 * 3 is 0.30000000000000004 before rounding.
    expect(row.endsWith(',0.3')).toBe(true);
  });
});

describe('weightEntriesCsv', () => {
  const weighIn: WeightEntry = { id: 'w1', loggedAt: AT, weightKg: 80.44, note: null };

  it('names the column after the chosen unit', () => {
    expect(weightEntriesCsv([], 'kg').startsWith('logged_at,weight_kg')).toBe(true);
    expect(weightEntriesCsv([], 'lb').startsWith('logged_at,weight_lb')).toBe(true);
  });

  it('converts to the chosen unit', () => {
    const [, kg] = weightEntriesCsv([weighIn], 'kg').split('\r\n');
    const [, lb] = weightEntriesCsv([weighIn], 'lb').split('\r\n');

    expect(kg).toBe('2026-06-10 13:05,80.44,');
    expect(lb).toBe('2026-06-10 13:05,177.34,');
  });

  it('leaves a missing note as an empty field', () => {
    const [, row] = weightEntriesCsv([weighIn], 'kg').split('\r\n');
    expect(row.endsWith(',')).toBe(true);
  });

  it('quotes a note containing a comma', () => {
    const [, row] = weightEntriesCsv(
      [{ ...weighIn, note: 'after gym, before food' }],
      'kg',
    ).split('\r\n');

    expect(row).toContain('"after gym, before food"');
  });
});
