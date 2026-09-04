/**
 * Backup envelope and validation.
 *
 * This is the module that decides whether a file the user picked is allowed to
 * touch their data, so it validates rather than trusts. A wrong `any` cast here
 * writes garbage into the health history the backup exists to protect.
 */

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
import { MEAL_TYPES } from '@/domain/types';

export const BACKUP_FORMAT = 'personal-health-backup';
export const BACKUP_VERSION = 1;

export interface BackupSettings {
  profile: Profile | null;
  units: UnitPreferences | null;
  reminders: unknown;
}

export interface BackupData {
  foods: Food[];
  foodEntries: FoodEntry[];
  weightEntries: WeightEntry[];
  waterEntries: WaterEntry[];
  goals: Goal[];
  settings: BackupSettings;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  /** The database's user_version, so a future build can tell what it is reading. */
  schemaVersion: number;
  data: BackupData;
}

export type ParseResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; error: string };

export function buildBackup(
  data: BackupData,
  schemaVersion: number,
  now: number = Date.now(),
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    schemaVersion,
    data,
  };
}

export function backupCounts(backup: BackupFile): Record<string, number> {
  return {
    foods: backup.data.foods.length,
    entries: backup.data.foodEntries.length,
    weighIns: backup.data.weightEntries.length,
    water: backup.data.waterEntries.length,
    goals: backup.data.goals.length,
  };
}

// --- validation ---------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isMacros(value: unknown): boolean {
  return (
    isObject(value) &&
    isFiniteNumber(value.kcal) &&
    isFiniteNumber(value.proteinG) &&
    isFiniteNumber(value.carbsG) &&
    isFiniteNumber(value.fatG)
  );
}

function isFood(value: unknown): value is Food {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNullableString(value.brand) &&
    isString(value.servingLabel) &&
    isNullableNumber(value.servingGrams) &&
    isMacros(value.perServing) &&
    typeof value.isFavorite === 'boolean' &&
    isFiniteNumber(value.createdAt)
  );
}

function isFoodEntry(value: unknown): value is FoodEntry {
  return (
    isObject(value) &&
    isString(value.id) &&
    isNullableString(value.foodId) &&
    isString(value.name) &&
    isFiniteNumber(value.loggedAt) &&
    isString(value.meal) &&
    MEAL_TYPES.includes(value.meal as MealType) &&
    isFiniteNumber(value.servings) &&
    isMacros(value.perServing)
  );
}

function isWeightEntry(value: unknown): value is WeightEntry {
  return (
    isObject(value) &&
    isString(value.id) &&
    isFiniteNumber(value.loggedAt) &&
    isFiniteNumber(value.weightKg) &&
    isNullableString(value.note)
  );
}

function isWaterEntry(value: unknown): value is WaterEntry {
  return (
    isObject(value) &&
    isString(value.id) &&
    isFiniteNumber(value.loggedAt) &&
    isFiniteNumber(value.volumeMl)
  );
}

function isGoal(value: unknown): value is Goal {
  return (
    isObject(value) &&
    isString(value.id) &&
    isFiniteNumber(value.effectiveFrom) &&
    isMacros(value.daily) &&
    isFiniteNumber(value.dailyWaterMl) &&
    isNullableNumber(value.targetWeightKg) &&
    isNullableNumber(value.targetDate)
  );
}

function validateArray<T>(
  value: unknown,
  guard: (item: unknown) => item is T,
  name: string,
): { ok: true; items: T[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: `"${name}" is missing or not a list.` };
  }

  for (let index = 0; index < value.length; index++) {
    if (!guard(value[index])) {
      // Naming the index makes a hand-edited file debuggable.
      return { ok: false, error: `${name}[${index}] is not a valid record.` };
    }
  }

  return { ok: true, items: value as T[] };
}

/**
 * Parses and validates a backup file.
 *
 * Rejects with a readable reason rather than throwing, so the import screen can
 * explain what is wrong with the file the user picked.
 */
export function parseBackup(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }

  if (!isObject(parsed)) {
    return { ok: false, error: 'That file does not contain a backup object.' };
  }

  if (parsed.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      error: 'That file is not a Personal Health backup.',
    };
  }

  if (!isFiniteNumber(parsed.version) || parsed.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `That backup was written by a newer version of the app (format ${String(
        parsed.version,
      )}). Update the app first.`,
    };
  }

  if (!isObject(parsed.data)) {
    return { ok: false, error: 'The backup has no data section.' };
  }

  const data = parsed.data;

  const foods = validateArray(data.foods, isFood, 'foods');
  if (!foods.ok) return { ok: false, error: foods.error };

  const foodEntries = validateArray(data.foodEntries, isFoodEntry, 'foodEntries');
  if (!foodEntries.ok) return { ok: false, error: foodEntries.error };

  const weightEntries = validateArray(data.weightEntries, isWeightEntry, 'weightEntries');
  if (!weightEntries.ok) return { ok: false, error: weightEntries.error };

  const waterEntries = validateArray(data.waterEntries, isWaterEntry, 'waterEntries');
  if (!waterEntries.ok) return { ok: false, error: waterEntries.error };

  const goals = validateArray(data.goals, isGoal, 'goals');
  if (!goals.ok) return { ok: false, error: goals.error };

  const settings = isObject(data.settings) ? data.settings : {};

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: parsed.version,
      exportedAt: isFiniteNumber(parsed.exportedAt) ? parsed.exportedAt : 0,
      schemaVersion: isFiniteNumber(parsed.schemaVersion) ? parsed.schemaVersion : 0,
      data: {
        foods: foods.items,
        foodEntries: foodEntries.items,
        weightEntries: weightEntries.items,
        waterEntries: waterEntries.items,
        goals: goals.items,
        settings: {
          profile: (settings.profile as Profile | null) ?? null,
          units: (settings.units as UnitPreferences | null) ?? null,
          reminders: settings.reminders ?? null,
        },
      },
    },
  };
}

/** Filename for an export, sortable and unambiguous. */
export function backupFilename(now: number = Date.now()): string {
  const date = new Date(now);
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

  return `personal-health-${stamp}.json`;
}
