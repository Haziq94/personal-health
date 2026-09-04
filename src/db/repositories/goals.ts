import type { SqlDriver } from '@/db/driver';
import { newId } from '@/domain/id';
import type { Goal, Macros } from '@/domain/types';

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

function toGoal(row: GoalRow): Goal {
  return {
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
  };
}

export interface NewGoal {
  effectiveFrom: number;
  daily: Macros;
  dailyWaterMl: number;
  targetWeightKg?: number | null;
  targetDate?: number | null;
}

/** Goals are append-only history; this adds a new one rather than editing. */
export async function insertGoal(db: SqlDriver, input: NewGoal): Promise<Goal> {
  const goal: Goal = {
    id: newId(),
    effectiveFrom: input.effectiveFrom,
    daily: input.daily,
    dailyWaterMl: input.dailyWaterMl,
    targetWeightKg: input.targetWeightKg ?? null,
    targetDate: input.targetDate ?? null,
  };

  await db.runAsync(
    `INSERT INTO goals
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

  return goal;
}

/**
 * The goal that was in force at `at`.
 *
 * Returns null when the date predates any goal, so past days are shown without
 * a target rather than judged against one you had not set yet.
 */
export async function goalAt(db: SqlDriver, at: number): Promise<Goal | null> {
  const row = await db.getFirstAsync<GoalRow>(
    `SELECT * FROM goals
     WHERE effective_from <= ?
     ORDER BY effective_from DESC
     LIMIT 1`,
    [at],
  );
  return row ? toGoal(row) : null;
}

export async function currentGoal(db: SqlDriver): Promise<Goal | null> {
  return goalAt(db, Date.now());
}

export async function deleteGoal(db: SqlDriver, id: string): Promise<void> {
  await db.runAsync('DELETE FROM goals WHERE id = ?', [id]);
}
