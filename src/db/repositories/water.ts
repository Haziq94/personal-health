import type { SqlDriver } from '@/db/driver';
import { endOfDay, startOfDay } from '@/domain/dates';
import { newId } from '@/domain/id';
import type { WaterEntry } from '@/domain/types';

interface WaterRow {
  id: string;
  logged_at: number;
  volume_ml: number;
}

function toEntry(row: WaterRow): WaterEntry {
  return { id: row.id, loggedAt: row.logged_at, volumeMl: row.volume_ml };
}

export async function insertWater(
  db: SqlDriver,
  input: { loggedAt: number; volumeMl: number },
): Promise<WaterEntry> {
  const entry: WaterEntry = {
    id: newId(),
    loggedAt: input.loggedAt,
    volumeMl: input.volumeMl,
  };

  await db.runAsync(
    'INSERT INTO water_entries (id, logged_at, volume_ml) VALUES (?, ?, ?)',
    [entry.id, entry.loggedAt, entry.volumeMl],
  );

  return entry;
}

export async function deleteWater(db: SqlDriver, id: string): Promise<void> {
  await db.runAsync('DELETE FROM water_entries WHERE id = ?', [id]);
}

export async function listWaterForDay(
  db: SqlDriver,
  dayMs: number,
): Promise<WaterEntry[]> {
  const rows = await db.getAllAsync<WaterRow>(
    `SELECT * FROM water_entries
     WHERE logged_at >= ? AND logged_at < ?
     ORDER BY logged_at ASC`,
    [startOfDay(dayMs), endOfDay(dayMs)],
  );
  return rows.map(toEntry);
}

export async function waterTotalForDay(db: SqlDriver, dayMs: number): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(volume_ml) AS total FROM water_entries
     WHERE logged_at >= ? AND logged_at < ?`,
    [startOfDay(dayMs), endOfDay(dayMs)],
  );
  return row?.total ?? 0;
}
