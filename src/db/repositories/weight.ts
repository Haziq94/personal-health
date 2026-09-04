import type { SqlDriver } from '@/db/driver';
import { newId } from '@/domain/id';
import type { WeightEntry } from '@/domain/types';

interface WeightRow {
  id: string;
  logged_at: number;
  weight_kg: number;
  note: string | null;
}

function toEntry(row: WeightRow): WeightEntry {
  return {
    id: row.id,
    loggedAt: row.logged_at,
    weightKg: row.weight_kg,
    note: row.note,
  };
}

export async function insertWeight(
  db: SqlDriver,
  input: { loggedAt: number; weightKg: number; note?: string | null },
): Promise<WeightEntry> {
  const entry: WeightEntry = {
    id: newId(),
    loggedAt: input.loggedAt,
    weightKg: input.weightKg,
    note: input.note?.trim() || null,
  };

  await db.runAsync(
    'INSERT INTO weight_entries (id, logged_at, weight_kg, note) VALUES (?, ?, ?, ?)',
    [entry.id, entry.loggedAt, entry.weightKg, entry.note],
  );

  return entry;
}

export async function updateWeight(db: SqlDriver, entry: WeightEntry): Promise<void> {
  await db.runAsync(
    'UPDATE weight_entries SET logged_at = ?, weight_kg = ?, note = ? WHERE id = ?',
    [entry.loggedAt, entry.weightKg, entry.note, entry.id],
  );
}

export async function deleteWeight(db: SqlDriver, id: string): Promise<void> {
  await db.runAsync('DELETE FROM weight_entries WHERE id = ?', [id]);
}

/** Oldest first — the order the trend maths in `@/domain/weight` expects. */
export async function listWeights(
  db: SqlDriver,
  options: { since?: number } = {},
): Promise<WeightEntry[]> {
  const { since = 0 } = options;
  const rows = await db.getAllAsync<WeightRow>(
    'SELECT * FROM weight_entries WHERE logged_at >= ? ORDER BY logged_at ASC',
    [since],
  );
  return rows.map(toEntry);
}

export async function latestWeight(db: SqlDriver): Promise<WeightEntry | null> {
  const row = await db.getFirstAsync<WeightRow>(
    'SELECT * FROM weight_entries ORDER BY logged_at DESC LIMIT 1',
  );
  return row ? toEntry(row) : null;
}
