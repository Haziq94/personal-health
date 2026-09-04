/**
 * Whole-database export and import.
 *
 * Reads and writes rows with their original ids, unlike the repositories, which
 * generate ids for new records. Preserving ids is what makes a re-import
 * idempotent rather than duplicating everything.
 */

import type { SqlDriver } from '@/db/driver';
import { getSchemaVersion } from '@/db/migrate';
import * as settingsRepo from '@/db/repositories/settings';
import type { BackupData, BackupFile } from '@/domain/backup';
import { buildBackup } from '@/domain/backup';
import type {
  Food,
  FoodEntry,
  Goal,
  MealType,
  Profile,
  UnitPreferences,
  WaterEntry,
  WeightEntry,
} from '@/domain/types';

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

interface WeightRow {
  id: string;
  logged_at: number;
  weight_kg: number;
  note: string | null;
}

interface WaterRow {
  id: string;
  logged_at: number;
  volume_ml: number;
}

interface GoalRow {
  id: string;
  effective_from: number;
  daily_kcal: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
  daily_water_ml: number;
  target_weight_kg: number | null;
  target_date: number | null;
}

export async function collectBackupData(db: SqlDriver): Promise<BackupData> {
  const [foodRows, entryRows, weightRows, waterRows, goalRows] = await Promise.all([
    db.getAllAsync<FoodRow>('SELECT * FROM foods ORDER BY created_at ASC'),
    db.getAllAsync<FoodEntryRow>('SELECT * FROM food_entries ORDER BY logged_at ASC'),
    db.getAllAsync<WeightRow>('SELECT * FROM weight_entries ORDER BY logged_at ASC'),
    db.getAllAsync<WaterRow>('SELECT * FROM water_entries ORDER BY logged_at ASC'),
    db.getAllAsync<GoalRow>('SELECT * FROM goals ORDER BY effective_from ASC'),
  ]);

  return {
    foods: foodRows.map(
      (row): Food => ({
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
      }),
    ),
    foodEntries: entryRows.map(
      (row): FoodEntry => ({
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
      }),
    ),
    weightEntries: weightRows.map(
      (row): WeightEntry => ({
        id: row.id,
        loggedAt: row.logged_at,
        weightKg: row.weight_kg,
        note: row.note,
      }),
    ),
    waterEntries: waterRows.map(
      (row): WaterEntry => ({
        id: row.id,
        loggedAt: row.logged_at,
        volumeMl: row.volume_ml,
      }),
    ),
    goals: goalRows.map(
      (row): Goal => ({
        id: row.id,
        effectiveFrom: row.effective_from,
        daily: {
          kcal: row.daily_kcal,
          proteinG: row.daily_protein_g,
          carbsG: row.daily_carbs_g,
          fatG: row.daily_fat_g,
        },
        dailyWaterMl: row.daily_water_ml,
        targetWeightKg: row.target_weight_kg,
        targetDate: row.target_date,
      }),
    ),
    settings: {
      profile: await settingsRepo.getProfile(db),
      units: await settingsRepo.getUnits(db),
      reminders: await settingsRepo.getSetting<unknown>(
        db,
        settingsRepo.SETTING_KEYS.reminders,
        null,
      ),
    },
  };
}

export async function exportBackup(
  db: SqlDriver,
  now: number = Date.now(),
): Promise<BackupFile> {
  const [data, schemaVersion] = await Promise.all([
    collectBackupData(db),
    getSchemaVersion(db),
  ]);

  return buildBackup(data, schemaVersion, now);
}

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  inserted: number;
  skipped: number;
}

/**
 * Writes a backup into the database.
 *
 * `merge` keeps what is already there and inserts only rows whose id is absent,
 * so importing the same file twice changes nothing the second time. `replace`
 * empties every table first — destructive, and the caller is responsible for
 * confirming it.
 *
 * The whole import runs in one transaction: a malformed row partway through
 * leaves the database exactly as it was rather than half-restored.
 */
export async function importBackup(
  db: SqlDriver,
  backup: BackupFile,
  mode: ImportMode,
): Promise<ImportResult> {
  const result: ImportResult = { inserted: 0, skipped: 0 };
  // `INSERT OR IGNORE` skips ids that already exist; changes tells us which
  // happened without a separate existence query per row.
  const verb = mode === 'replace' ? 'INSERT' : 'INSERT OR IGNORE';

  await db.withTransactionAsync(async () => {
    if (mode === 'replace') {
      // food_entries first: it references foods.
      for (const table of [
        'food_entries',
        'foods',
        'weight_entries',
        'water_entries',
        'goals',
      ]) {
        await db.execAsync(`DELETE FROM ${table}`);
      }
    }

    for (const food of backup.data.foods) {
      const run = await db.runAsync(
        `${verb} INTO foods
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
      tally(result, run.changes);
    }

    for (const entry of backup.data.foodEntries) {
      const run = await db.runAsync(
        `${verb} INTO food_entries
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
      tally(result, run.changes);
    }

    for (const entry of backup.data.weightEntries) {
      const run = await db.runAsync(
        `${verb} INTO weight_entries (id, logged_at, weight_kg, note) VALUES (?, ?, ?, ?)`,
        [entry.id, entry.loggedAt, entry.weightKg, entry.note],
      );
      tally(result, run.changes);
    }

    for (const entry of backup.data.waterEntries) {
      const run = await db.runAsync(
        `${verb} INTO water_entries (id, logged_at, volume_ml) VALUES (?, ?, ?)`,
        [entry.id, entry.loggedAt, entry.volumeMl],
      );
      tally(result, run.changes);
    }

    for (const goal of backup.data.goals) {
      const run = await db.runAsync(
        `${verb} INTO goals
           (id, effective_from, daily_kcal, daily_protein_g, daily_carbs_g,
            daily_fat_g, daily_water_ml, target_weight_kg, target_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          goal.id,
          goal.effectiveFrom,
          goal.daily.kcal,
          goal.daily.proteinG,
          goal.daily.carbsG,
          goal.daily.fatG,
          goal.dailyWaterMl,
          goal.targetWeightKg,
          goal.targetDate,
        ],
      );
      tally(result, run.changes);
    }

    // Settings are single-valued, so a merge would have nothing to merge:
    // only overwrite them when the backup actually carries a value.
    const settings = backup.data.settings;
    if (settings.profile) {
      await settingsRepo.setProfile(db, settings.profile as Profile);
    }
    if (settings.units) {
      await settingsRepo.setUnits(db, settings.units as UnitPreferences);
    }
    if (settings.reminders) {
      await settingsRepo.setSetting(
        db,
        settingsRepo.SETTING_KEYS.reminders,
        settings.reminders,
      );
    }
  });

  return result;
}

function tally(result: ImportResult, changes: number): void {
  if (changes > 0) result.inserted += 1;
  else result.skipped += 1;
}
