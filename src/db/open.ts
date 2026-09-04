import * as SQLite from 'expo-sqlite';

import type { SqlDriver } from '@/db/driver';
import { migrate } from '@/db/migrate';

export const DATABASE_NAME = 'personal-health.db';

let instance: SqlDriver | null = null;

/**
 * Opens the on-device database and brings it up to the current schema.
 * Subsequent calls return the same connection.
 */
export async function openDatabase(): Promise<SqlDriver> {
  if (instance) return instance;

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  // Required for the ON DELETE SET NULL link from food_entries to foods.
  await db.execAsync('PRAGMA foreign_keys = ON');

  const driver = db as unknown as SqlDriver;
  await migrate(driver);

  instance = driver;
  return instance;
}

/** Test/reset hook: forgets the cached connection. */
export function resetDatabaseHandle(): void {
  instance = null;
}
