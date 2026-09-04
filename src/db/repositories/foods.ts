import type { SqlDriver } from '@/db/driver';
import { newId } from '@/domain/id';
import type { Food, Macros } from '@/domain/types';

interface FoodRow {
  id: string;
  name: string;
  brand: string | null;
  serving_label: string;
  serving_grams: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  is_favorite: number;
  created_at: number;
}

function toFood(row: FoodRow): Food {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    servingLabel: row.serving_label,
    servingGrams: row.serving_grams,
    perServing: {
      kcal: row.kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
    },
    isFavorite: row.is_favorite === 1,
    createdAt: row.created_at,
  };
}

export interface NewFood {
  name: string;
  brand?: string | null;
  servingLabel: string;
  servingGrams?: number | null;
  perServing: Macros;
  isFavorite?: boolean;
}

export async function insertFood(
  db: SqlDriver,
  input: NewFood,
  now: number = Date.now(),
): Promise<Food> {
  const food: Food = {
    id: newId(),
    name: input.name.trim(),
    brand: input.brand?.trim() || null,
    servingLabel: input.servingLabel.trim(),
    servingGrams: input.servingGrams ?? null,
    perServing: input.perServing,
    isFavorite: input.isFavorite ?? false,
    createdAt: now,
  };

  await db.runAsync(
    `INSERT INTO foods
       (id, name, brand, serving_label, serving_grams,
        kcal, protein_g, carbs_g, fat_g, is_favorite, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      food.id,
      food.name,
      food.brand,
      food.servingLabel,
      food.servingGrams,
      food.perServing.kcal,
      food.perServing.proteinG,
      food.perServing.carbsG,
      food.perServing.fatG,
      food.isFavorite ? 1 : 0,
      food.createdAt,
    ],
  );

  return food;
}

export async function updateFood(db: SqlDriver, food: Food): Promise<void> {
  await db.runAsync(
    `UPDATE foods SET
       name = ?, brand = ?, serving_label = ?, serving_grams = ?,
       kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ?, is_favorite = ?
     WHERE id = ?`,
    [
      food.name,
      food.brand,
      food.servingLabel,
      food.servingGrams,
      food.perServing.kcal,
      food.perServing.proteinG,
      food.perServing.carbsG,
      food.perServing.fatG,
      food.isFavorite ? 1 : 0,
      food.id,
    ],
  );
}

export async function setFavorite(
  db: SqlDriver,
  id: string,
  isFavorite: boolean,
): Promise<void> {
  await db.runAsync('UPDATE foods SET is_favorite = ? WHERE id = ?', [
    isFavorite ? 1 : 0,
    id,
  ]);
}

export async function deleteFood(db: SqlDriver, id: string): Promise<void> {
  await db.runAsync('DELETE FROM foods WHERE id = ?', [id]);
}

export async function getFood(db: SqlDriver, id: string): Promise<Food | null> {
  const row = await db.getFirstAsync<FoodRow>('SELECT * FROM foods WHERE id = ?', [id]);
  return row ? toFood(row) : null;
}

/** Favourites first, then alphabetical. `search` matches name or brand. */
export async function listFoods(
  db: SqlDriver,
  options: { search?: string; limit?: number } = {},
): Promise<Food[]> {
  const { search, limit = 100 } = options;
  const term = search?.trim();

  const rows = term
    ? await db.getAllAsync<FoodRow>(
        `SELECT * FROM foods
         WHERE name LIKE ? OR brand LIKE ?
         ORDER BY is_favorite DESC, name COLLATE NOCASE ASC
         LIMIT ?`,
        [`%${term}%`, `%${term}%`, limit],
      )
    : await db.getAllAsync<FoodRow>(
        `SELECT * FROM foods
         ORDER BY is_favorite DESC, name COLLATE NOCASE ASC
         LIMIT ?`,
        [limit],
      );

  return rows.map(toFood);
}

/**
 * Foods logged most often since `since`, for the quick-add row. This is what
 * makes a repeat meal a single tap, so it is ordered by real usage rather than
 * by recency alone.
 */
export async function listMostLogged(
  db: SqlDriver,
  options: { since?: number; limit?: number } = {},
): Promise<Food[]> {
  const { since = 0, limit = 8 } = options;
  const rows = await db.getAllAsync<FoodRow>(
    `SELECT f.*, COUNT(e.id) AS uses
     FROM foods f
     JOIN food_entries e ON e.food_id = f.id AND e.logged_at >= ?
     GROUP BY f.id
     ORDER BY uses DESC, f.name COLLATE NOCASE ASC
     LIMIT ?`,
    [since, limit],
  );
  return rows.map(toFood);
}
