import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { migrate } from '@/db/migrate';
import * as foodEntries from '@/db/repositories/food-entries';
import * as foods from '@/db/repositories/foods';
import * as goals from '@/db/repositories/goals';
import * as settings from '@/db/repositories/settings';
import * as water from '@/db/repositories/water';
import * as weight from '@/db/repositories/weight';
import { createTestDriver, type TestDriver } from '@/db/test-driver';
import { MS_PER_DAY, startOfDay } from '@/domain/dates';
import type { Macros, Profile } from '@/domain/types';

const NOON = new Date(2026, 5, 10, 12).getTime();
const HOUR = 3600_000;

const rice: Macros = { kcal: 200, proteinG: 4, carbsG: 44, fatG: 0.5 };
const eggs: Macros = { kcal: 155, proteinG: 13, carbsG: 1.1, fatG: 11 };

let db: TestDriver;

beforeEach(async () => {
  db = createTestDriver();
  await migrate(db);
});

afterEach(() => {
  db.close();
});

describe('foods', () => {
  it('round-trips a food', async () => {
    const created = await foods.insertFood(
      db,
      { name: 'Nasi lemak', servingLabel: '1 plate', perServing: rice },
      NOON,
    );

    expect(await foods.getFood(db, created.id)).toEqual(created);
  });

  it('trims whitespace and stores an empty brand as null', async () => {
    const food = await foods.insertFood(db, {
      name: '  Oats  ',
      brand: '   ',
      servingLabel: ' 40 g ',
      perServing: rice,
    });

    expect(food.name).toBe('Oats');
    expect(food.brand).toBeNull();
    expect(food.servingLabel).toBe('40 g');
  });

  it('returns null for a food that does not exist', async () => {
    expect(await foods.getFood(db, 'nope')).toBeNull();
  });

  it('lists favourites first, then alphabetically', async () => {
    await foods.insertFood(db, { name: 'Banana', servingLabel: '1', perServing: rice });
    await foods.insertFood(db, { name: 'Apple', servingLabel: '1', perServing: rice });
    const teh = await foods.insertFood(db, {
      name: 'Teh tarik',
      servingLabel: '1 glass',
      perServing: rice,
    });
    await foods.setFavorite(db, teh.id, true);

    expect((await foods.listFoods(db)).map((f) => f.name)).toEqual([
      'Teh tarik',
      'Apple',
      'Banana',
    ]);
  });

  it('searches name and brand', async () => {
    await foods.insertFood(db, {
      name: 'Greek yoghurt',
      brand: 'Farm Fresh',
      servingLabel: '1 tub',
      perServing: eggs,
    });
    await foods.insertFood(db, { name: 'Rice', servingLabel: '1 bowl', perServing: rice });

    expect((await foods.listFoods(db, { search: 'yogh' })).map((f) => f.name)).toEqual([
      'Greek yoghurt',
    ]);
    expect((await foods.listFoods(db, { search: 'farm' })).map((f) => f.name)).toEqual([
      'Greek yoghurt',
    ]);
    expect(await foods.listFoods(db, { search: 'zzz' })).toEqual([]);
  });

  it('updates an existing food', async () => {
    const food = await foods.insertFood(db, {
      name: 'Rice',
      servingLabel: '1 bowl',
      perServing: rice,
    });

    await foods.updateFood(db, { ...food, name: 'White rice', isFavorite: true });
    const updated = await foods.getFood(db, food.id);

    expect(updated?.name).toBe('White rice');
    expect(updated?.isFavorite).toBe(true);
  });

  it('ranks the quick-add list by how often each food is logged', async () => {
    const a = await foods.insertFood(db, { name: 'A', servingLabel: '1', perServing: rice });
    const b = await foods.insertFood(db, { name: 'B', servingLabel: '1', perServing: rice });

    for (let i = 0; i < 3; i++) {
      await foodEntries.insertEntry(db, {
        foodId: b.id,
        name: 'B',
        loggedAt: NOON,
        meal: 'lunch',
        servings: 1,
        perServing: rice,
      });
    }
    await foodEntries.insertEntry(db, {
      foodId: a.id,
      name: 'A',
      loggedAt: NOON,
      meal: 'lunch',
      servings: 1,
      perServing: rice,
    });

    expect((await foods.listMostLogged(db)).map((f) => f.name)).toEqual(['B', 'A']);
  });
});

describe('food entries', () => {
  async function log(overrides: Partial<foodEntries.NewFoodEntry> = {}) {
    return foodEntries.insertEntry(db, {
      name: 'Rice',
      loggedAt: NOON,
      meal: 'lunch',
      servings: 1,
      perServing: rice,
      ...overrides,
    });
  }

  it('lists entries for the local day only', async () => {
    await log();
    await log({ loggedAt: NOON - MS_PER_DAY, name: 'Yesterday' });
    await log({ loggedAt: NOON + MS_PER_DAY, name: 'Tomorrow' });

    const today = await foodEntries.listEntriesForDay(db, NOON);
    expect(today.map((e) => e.name)).toEqual(['Rice']);
  });

  it('includes entries at both ends of the day', async () => {
    const midnight = startOfDay(NOON);
    await log({ loggedAt: midnight, name: 'Just after midnight' });
    await log({ loggedAt: midnight + MS_PER_DAY - 1, name: 'Just before midnight' });

    expect(await foodEntries.listEntriesForDay(db, NOON)).toHaveLength(2);
  });

  it('preserves the macro snapshot when the food is later corrected', async () => {
    const food = await foods.insertFood(db, {
      name: 'Rice',
      servingLabel: '1 bowl',
      perServing: rice,
    });
    const entry = await log({ foodId: food.id, perServing: rice });

    await foods.updateFood(db, { ...food, perServing: { ...rice, kcal: 999 } });

    const [logged] = await foodEntries.listEntriesForDay(db, NOON);
    expect(logged.perServing.kcal).toBe(200);
    expect(logged.id).toBe(entry.id);
  });

  it('keeps the entry readable after its food is deleted', async () => {
    const food = await foods.insertFood(db, {
      name: 'Rice',
      servingLabel: '1 bowl',
      perServing: rice,
    });
    await log({ foodId: food.id, name: 'Rice' });

    await foods.deleteFood(db, food.id);

    const [logged] = await foodEntries.listEntriesForDay(db, NOON);
    expect(logged.foodId).toBeNull();
    expect(logged.name).toBe('Rice');
    expect(logged.perServing.kcal).toBe(200);
  });

  it('fetches a single entry by id', async () => {
    const entry = await log({ servings: 1.5 });

    expect(await foodEntries.getEntry(db, entry.id)).toEqual(entry);
  });

  it('returns null for an entry that does not exist', async () => {
    expect(await foodEntries.getEntry(db, 'gone')).toBeNull();
  });

  it('updates and deletes entries', async () => {
    const entry = await log();

    await foodEntries.updateEntry(db, { ...entry, servings: 2, meal: 'dinner' });
    const [stored] = await foodEntries.listEntriesForDay(db, NOON);
    expect(stored.servings).toBe(2);
    expect(stored.meal).toBe('dinner');

    await foodEntries.deleteEntry(db, entry.id);
    expect(await foodEntries.listEntriesForDay(db, NOON)).toEqual([]);
  });

  it('aggregates totals per local day', async () => {
    await log({ servings: 2 });
    await log({ perServing: eggs, meal: 'breakfast' });
    await log({ loggedAt: NOON + MS_PER_DAY, servings: 1 });

    const totals = await foodEntries.dailyTotals(
      db,
      startOfDay(NOON),
      startOfDay(NOON) + 3 * MS_PER_DAY,
    );

    expect(totals).toHaveLength(2);
    expect(totals[0].day).toBe(startOfDay(NOON));
    expect(totals[0].kcal).toBeCloseTo(555, 6);
    expect(totals[0].entryCount).toBe(2);
    expect(totals[1].kcal).toBeCloseTo(200, 6);
  });

  it('returns no totals for a range with no entries', async () => {
    expect(await foodEntries.dailyTotals(db, NOON, NOON + MS_PER_DAY)).toEqual([]);
  });
});

describe('weight', () => {
  it('lists oldest first', async () => {
    await weight.insertWeight(db, { loggedAt: NOON, weightKg: 80 });
    await weight.insertWeight(db, { loggedAt: NOON - MS_PER_DAY, weightKg: 81 });

    expect((await weight.listWeights(db)).map((w) => w.weightKg)).toEqual([81, 80]);
  });

  it('reports the most recent weigh-in', async () => {
    await weight.insertWeight(db, { loggedAt: NOON - MS_PER_DAY, weightKg: 81 });
    await weight.insertWeight(db, { loggedAt: NOON, weightKg: 80 });

    expect((await weight.latestWeight(db))?.weightKg).toBe(80);
  });

  it('is null with no history', async () => {
    expect(await weight.latestWeight(db)).toBeNull();
  });

  it('filters by date', async () => {
    await weight.insertWeight(db, { loggedAt: NOON - 10 * MS_PER_DAY, weightKg: 85 });
    await weight.insertWeight(db, { loggedAt: NOON, weightKg: 80 });

    expect(await weight.listWeights(db, { since: NOON - MS_PER_DAY })).toHaveLength(1);
  });

  it('updates and deletes', async () => {
    const entry = await weight.insertWeight(db, { loggedAt: NOON, weightKg: 80 });

    await weight.updateWeight(db, { ...entry, weightKg: 79.4, note: 'after gym' });
    expect((await weight.latestWeight(db))?.weightKg).toBe(79.4);

    await weight.deleteWeight(db, entry.id);
    expect(await weight.listWeights(db)).toEqual([]);
  });
});

describe('water', () => {
  it('totals the day', async () => {
    await water.insertWater(db, { loggedAt: NOON, volumeMl: 250 });
    await water.insertWater(db, { loggedAt: NOON + HOUR, volumeMl: 500 });
    await water.insertWater(db, { loggedAt: NOON + MS_PER_DAY, volumeMl: 1000 });

    expect(await water.waterTotalForDay(db, NOON)).toBe(750);
  });

  it('totals zero for an empty day rather than null', async () => {
    expect(await water.waterTotalForDay(db, NOON)).toBe(0);
  });

  it('deletes an entry', async () => {
    const entry = await water.insertWater(db, { loggedAt: NOON, volumeMl: 250 });
    await water.deleteWater(db, entry.id);

    expect(await water.listWaterForDay(db, NOON)).toEqual([]);
  });
});

describe('goals', () => {
  const daily: Macros = { kcal: 2200, proteinG: 165, carbsG: 220, fatG: 73 };

  it('returns the goal in force on a given day', async () => {
    await goals.insertGoal(db, {
      effectiveFrom: NOON - 30 * MS_PER_DAY,
      daily,
      dailyWaterMl: 2000,
    });
    await goals.insertGoal(db, {
      effectiveFrom: NOON,
      daily: { ...daily, kcal: 2000 },
      dailyWaterMl: 2500,
    });

    expect((await goals.goalAt(db, NOON - 10 * MS_PER_DAY))?.daily.kcal).toBe(2200);
    expect((await goals.goalAt(db, NOON + MS_PER_DAY))?.daily.kcal).toBe(2000);
  });

  it('is null before any goal was set', async () => {
    await goals.insertGoal(db, { effectiveFrom: NOON, daily, dailyWaterMl: 2000 });

    expect(await goals.goalAt(db, NOON - MS_PER_DAY)).toBeNull();
  });

  it('keeps an optional target weight and date', async () => {
    const goal = await goals.insertGoal(db, {
      effectiveFrom: NOON,
      daily,
      dailyWaterMl: 2000,
      targetWeightKg: 72,
      targetDate: NOON + 90 * MS_PER_DAY,
    });

    expect(await goals.goalAt(db, NOON)).toEqual(goal);
  });
});

describe('settings', () => {
  const profile: Profile = {
    heightCm: 175,
    birthYear: 1994,
    sex: 'male',
    activityLevel: 'light',
  };

  const metric = { weight: 'kg', volume: 'ml', height: 'cm' } as const;

  it('falls back when unset', async () => {
    expect(await settings.getProfile(db)).toBeNull();
    expect(await settings.getUnits(db)).toEqual(metric);
  });

  it('round-trips the profile', async () => {
    await settings.setProfile(db, profile);
    expect(await settings.getProfile(db)).toEqual(profile);
  });

  it('overwrites rather than duplicating on repeated writes', async () => {
    await settings.setUnits(db, { weight: 'lb', volume: 'floz', height: 'in' });
    await settings.setUnits(db, { weight: 'kg', volume: 'ml', height: 'cm' });

    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM settings WHERE key = 'units'",
    );
    expect(row?.count).toBe(1);
    expect((await settings.getUnits(db)).weight).toBe('kg');
  });

  it('degrades to the fallback when a stored value is corrupt', async () => {
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('units', 'not json')");

    expect(await settings.getUnits(db)).toEqual(metric);
  });
});
