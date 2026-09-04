import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { collectBackupData, exportBackup, importBackup } from '@/db/backup';
import { migrate } from '@/db/migrate';
import * as foodEntriesRepo from '@/db/repositories/food-entries';
import * as foodsRepo from '@/db/repositories/foods';
import * as goalsRepo from '@/db/repositories/goals';
import * as settingsRepo from '@/db/repositories/settings';
import * as waterRepo from '@/db/repositories/water';
import * as weightRepo from '@/db/repositories/weight';
import { createTestDriver, type TestDriver } from '@/db/test-driver';
import { buildBackup, parseBackup } from '@/domain/backup';
import type { Macros, Profile } from '@/domain/types';

const NOON = new Date(2026, 5, 10, 12).getTime();
const rice: Macros = { kcal: 200, proteinG: 4, carbsG: 44, fatG: 0.5 };

const profile: Profile = {
  heightCm: 175,
  birthYear: 1994,
  sex: 'male',
  activityLevel: 'light',
};

let db: TestDriver;

beforeEach(async () => {
  db = createTestDriver();
  await migrate(db);
});

afterEach(() => {
  db.close();
});

/** Populates a database with one of everything. */
async function seed(target: TestDriver) {
  const food = await foodsRepo.insertFood(
    target,
    { name: 'Rice', servingLabel: '1 bowl', perServing: rice, isFavorite: true },
    NOON,
  );
  await foodEntriesRepo.insertEntry(target, {
    foodId: food.id,
    name: 'Rice',
    loggedAt: NOON,
    meal: 'lunch',
    servings: 1.5,
    perServing: rice,
  });
  await weightRepo.insertWeight(target, {
    loggedAt: NOON,
    weightKg: 80.4,
    note: 'after gym',
  });
  await waterRepo.insertWater(target, { loggedAt: NOON, volumeMl: 250 });
  await goalsRepo.insertGoal(target, {
    effectiveFrom: NOON,
    daily: { kcal: 2200, proteinG: 165, carbsG: 220, fatG: 73 },
    dailyWaterMl: 2000,
    targetWeightKg: 75,
  });
  await settingsRepo.setProfile(target, profile);
  return food;
}

describe('exportBackup', () => {
  it('captures every collection', async () => {
    await seed(db);
    const backup = await exportBackup(db, NOON);

    expect(backup.data.foods).toHaveLength(1);
    expect(backup.data.foodEntries).toHaveLength(1);
    expect(backup.data.weightEntries).toHaveLength(1);
    expect(backup.data.waterEntries).toHaveLength(1);
    expect(backup.data.goals).toHaveLength(1);
    expect(backup.data.settings.profile).toEqual(profile);
  });

  it('records the schema version it was taken at', async () => {
    const backup = await exportBackup(db, NOON);
    expect(backup.schemaVersion).toBe(1);
  });

  it('exports an empty database without complaint', async () => {
    const backup = await exportBackup(db, NOON);
    expect(backup.data.foods).toEqual([]);
    expect(backup.data.settings.profile).toBeNull();
  });
});

describe('round trip', () => {
  it('restores an identical database through JSON', async () => {
    await seed(db);
    const original = await collectBackupData(db);
    const json = JSON.stringify(await exportBackup(db, NOON));

    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const restored = createTestDriver();
    try {
      await migrate(restored);
      await importBackup(restored, parsed.backup, 'replace');

      expect(await collectBackupData(restored)).toEqual(original);
    } finally {
      restored.close();
    }
  });

  it('preserves the logged macros and servings exactly', async () => {
    await seed(db);
    const json = JSON.stringify(await exportBackup(db, NOON));
    const parsed = parseBackup(json);
    if (!parsed.ok) throw new Error(parsed.error);

    const restored = createTestDriver();
    try {
      await migrate(restored);
      await importBackup(restored, parsed.backup, 'replace');

      const [entry] = await foodEntriesRepo.listEntriesForDay(restored, NOON);
      expect(entry.servings).toBe(1.5);
      expect(entry.perServing).toEqual(rice);
      expect(entry.name).toBe('Rice');
    } finally {
      restored.close();
    }
  });
});

describe('importBackup', () => {
  it('is idempotent in merge mode', async () => {
    await seed(db);
    const backup = await exportBackup(db, NOON);

    const first = await importBackup(db, backup, 'merge');
    expect(first.inserted).toBe(0);
    expect(first.skipped).toBe(5);

    // Importing the same file again must not duplicate anything.
    await importBackup(db, backup, 'merge');
    const after = await collectBackupData(db);
    expect(after.foods).toHaveLength(1);
    expect(after.foodEntries).toHaveLength(1);
  });

  it('merges new records alongside existing ones', async () => {
    await seed(db);
    const existing = await collectBackupData(db);

    const incoming = buildBackup(
      {
        ...existing,
        weightEntries: [
          ...existing.weightEntries,
          { id: 'new-weigh-in', loggedAt: NOON + 1000, weightKg: 79.8, note: null },
        ],
      },
      1,
      NOON,
    );

    const result = await importBackup(db, incoming, 'merge');

    expect(result.inserted).toBe(1);
    expect(await weightRepo.listWeights(db)).toHaveLength(2);
  });

  it('replaces everything in replace mode', async () => {
    await seed(db);

    const replacement = buildBackup(
      {
        foods: [],
        foodEntries: [],
        weightEntries: [{ id: 'only', loggedAt: NOON, weightKg: 70, note: null }],
        waterEntries: [],
        goals: [],
        settings: { profile: null, units: null, reminders: null },
      },
      1,
      NOON,
    );

    await importBackup(db, replacement, 'replace');
    const after = await collectBackupData(db);

    expect(after.foods).toEqual([]);
    expect(after.foodEntries).toEqual([]);
    expect(after.weightEntries).toHaveLength(1);
    expect(after.weightEntries[0].weightKg).toBe(70);
  });

  it('leaves the database untouched when an import fails partway', async () => {
    await seed(db);
    const before = await collectBackupData(db);

    const backup = await exportBackup(db, NOON);
    // A duplicate id inside one file: the second INSERT violates the primary
    // key, and replace mode does not use INSERT OR IGNORE.
    backup.data.weightEntries = [
      { id: 'dup', loggedAt: NOON, weightKg: 70, note: null },
      { id: 'dup', loggedAt: NOON, weightKg: 71, note: null },
    ];

    await expect(importBackup(db, backup, 'replace')).rejects.toThrow();

    // The transaction rolled back, so the original data is still there.
    expect(await collectBackupData(db)).toEqual(before);
  });

  it('does not overwrite settings the backup does not carry', async () => {
    await settingsRepo.setProfile(db, profile);

    const backup = buildBackup(
      {
        foods: [],
        foodEntries: [],
        weightEntries: [],
        waterEntries: [],
        goals: [],
        settings: { profile: null, units: null, reminders: null },
      },
      1,
      NOON,
    );

    await importBackup(db, backup, 'merge');

    expect(await settingsRepo.getProfile(db)).toEqual(profile);
  });
});
