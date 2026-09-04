import type { SqlDriver } from '@/db/driver';
import { endOfDay, startOfDay } from '@/domain/dates';
import { newId } from '@/domain/id';
import type { FoodEntry, Macros, MealType } from '@/domain/types';

interface FoodEntryRow {
  id: string;
  food_id: string | null;
  name: string;
  logged_at: number;
  meal: string;
  servings: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

function toEntry(row: FoodEntryRow): FoodEntry {
  return {
    id: row.id,
    foodId: row.food_id,
    name: row.name,
    loggedAt: row.logged_at,
    meal: row.meal as MealType,
    servings: row.servings,
    perServing: {
      kcal: row.kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
    },
  };
}

export interface NewFoodEntry {
  foodId?: string | null;
  name: string;
  loggedAt: number;
  meal: MealType;
  servings: number;
  /** Snapshot of the food's macros, per single serving. */
  perServing: Macros;
}

export async function insertEntry(
  db: SqlDriver,
  input: NewFoodEntry,
): Promise<FoodEntry> {
  const entry: FoodEntry = {
    id: newId(),
    foodId: input.foodId ?? null,
    name: input.name.trim(),
    loggedAt: input.loggedAt,
    meal: input.meal,
    servings: input.servings,
    perServing: input.perServing,
  };

  await db.runAsync(
    `INSERT INTO food_entries
       (id, food_id, name, logged_at, meal, servings, kcal, protein_g, carbs_g, fat_g)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.foodId,
      entry.name,
      entry.loggedAt,
      entry.meal,
      entry.servings,
      entry.perServing.kcal,
      entry.perServing.proteinG,
      entry.perServing.carbsG,
      entry.perServing.fatG,
    ],
  );

  return entry;
}

export async function getEntry(db: SqlDriver, id: string): Promise<FoodEntry | null> {
  const row = await db.getFirstAsync<FoodEntryRow>(
    'SELECT * FROM food_entries WHERE id = ?',
    [id],
  );
  return row ? toEntry(row) : null;
}

export async function updateEntry(db: SqlDriver, entry: FoodEntry): Promise<void> {
  await db.runAsync(
    `UPDATE food_entries SET
       name = ?, logged_at = ?, meal = ?, servings = ?,
       kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ?
     WHERE id = ?`,
    [
      entry.name,
      entry.loggedAt,
      entry.meal,
      entry.servings,
      entry.perServing.kcal,
      entry.perServing.proteinG,
      entry.perServing.carbsG,
      entry.perServing.fatG,
      entry.id,
    ],
  );
}

export async function deleteEntry(db: SqlDriver, id: string): Promise<void> {
  await db.runAsync('DELETE FROM food_entries WHERE id = ?', [id]);
}

/** Entries logged on the local day containing `dayMs`, oldest first. */
export async function listEntriesForDay(
  db: SqlDriver,
  dayMs: number,
): Promise<FoodEntry[]> {
  return listEntriesBetween(db, startOfDay(dayMs), endOfDay(dayMs));
}

/** `from` inclusive, `to` exclusive. */
export async function listEntriesBetween(
  db: SqlDriver,
  from: number,
  to: number,
): Promise<FoodEntry[]> {
  const rows = await db.getAllAsync<FoodEntryRow>(
    `SELECT * FROM food_entries
     WHERE logged_at >= ? AND logged_at < ?
     ORDER BY logged_at ASC`,
    [from, to],
  );
  return rows.map(toEntry);
}

export interface DailyTotal {
  /** Local midnight for the day. */
  day: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  entryCount: number;
}

/**
 * Per-day totals for the History screen.
 *
 * Aggregating in SQL rather than loading every entry keeps a year of history
 * from being read into memory just to draw a list. Grouping is done in JS on
 * local midnights because SQLite's date functions work in UTC, which would put
 * late-evening entries on the wrong day.
 */
export async function dailyTotals(
  db: SqlDriver,
  from: number,
  to: number,
): Promise<DailyTotal[]> {
  const entries = await listEntriesBetween(db, from, to);
  const byDay = new Map<number, DailyTotal>();

  for (const entry of entries) {
    const day = startOfDay(entry.loggedAt);
    const total = byDay.get(day) ?? {
      day,
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      entryCount: 0,
    };
    total.kcal += entry.perServing.kcal * entry.servings;
    total.proteinG += entry.perServing.proteinG * entry.servings;
    total.carbsG += entry.perServing.carbsG * entry.servings;
    total.fatG += entry.perServing.fatG * entry.servings;
    total.entryCount += 1;
    byDay.set(day, total);
  }

  return [...byDay.values()].sort((a, b) => a.day - b.day);
}
