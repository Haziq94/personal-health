/**
 * CSV shapes for the spreadsheet exports.
 *
 * Separate from the JSON backup on purpose: the backup is for restoring and
 * must be lossless, while these are for reading and are allowed to flatten and
 * convert units.
 */

import { toCsv } from '@/domain/csv';
import { entryTotal } from '@/domain/nutrition';
import type { FoodEntry, WeightEntry, WeightUnit } from '@/domain/types';
import { kgToUnit } from '@/domain/units';

/** ISO 8601 local date and time, which spreadsheets parse without a fight. */
function isoLocal(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function foodEntriesCsv(entries: readonly FoodEntry[]): string {
  return toCsv(
    ['logged_at', 'meal', 'food', 'servings', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
    entries.map((entry) => {
      const total = entryTotal(entry);
      return [
        isoLocal(entry.loggedAt),
        entry.meal,
        entry.name,
        entry.servings,
        round(total.kcal),
        round(total.proteinG),
        round(total.carbsG),
        round(total.fatG),
      ];
    }),
  );
}

export function weightEntriesCsv(
  entries: readonly WeightEntry[],
  unit: WeightUnit,
): string {
  return toCsv(
    ['logged_at', `weight_${unit}`, 'note'],
    entries.map((entry) => [
      isoLocal(entry.loggedAt),
      round(kgToUnit(entry.weightKg, unit), 2),
      entry.note,
    ]),
  );
}

/** Keeps floating-point noise out of the file — 0.30000000000000004 helps nobody. */
function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
