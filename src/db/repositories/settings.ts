/**
 * Key/value settings, stored as JSON.
 *
 * Profile and unit preferences are single-row data that changes shape as the
 * app grows; a key/value table avoids a migration every time a preference is
 * added.
 */

import type { SqlDriver } from '@/db/driver';
import type { Profile, UnitPreferences } from '@/domain/types';
import { DEFAULT_UNITS } from '@/domain/types';

export const SETTING_KEYS = {
  profile: 'profile',
  units: 'units',
  reminders: 'reminders',
} as const;

export async function getSetting<T>(
  db: SqlDriver,
  key: string,
  fallback: T,
): Promise<T> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key],
  );
  if (!row) return fallback;

  try {
    return JSON.parse(row.value) as T;
  } catch {
    // A corrupt value should degrade to the default, not crash the app on boot.
    return fallback;
  }
}

export async function setSetting<T>(db: SqlDriver, key: string, value: T): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, JSON.stringify(value)],
  );
}

export async function getProfile(db: SqlDriver): Promise<Profile | null> {
  return getSetting<Profile | null>(db, SETTING_KEYS.profile, null);
}

export async function setProfile(db: SqlDriver, profile: Profile): Promise<void> {
  await setSetting(db, SETTING_KEYS.profile, profile);
}

export async function getUnits(db: SqlDriver): Promise<UnitPreferences> {
  return getSetting<UnitPreferences>(db, SETTING_KEYS.units, DEFAULT_UNITS);
}

export async function setUnits(db: SqlDriver, units: UnitPreferences): Promise<void> {
  await setSetting(db, SETTING_KEYS.units, units);
}
