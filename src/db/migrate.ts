import type { SqlDriver } from '@/db/driver';
import { MIGRATIONS, type Migration } from '@/db/schema';

interface UserVersionRow {
  user_version: number;
}

export async function getSchemaVersion(db: SqlDriver): Promise<number> {
  const row = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Applies every migration the database has not seen yet.
 *
 * The version is the count of applied migrations, stored in SQLite's own
 * `user_version`, so no bookkeeping table is needed. Each migration runs inside
 * a transaction together with its version bump: a migration that throws leaves
 * the database exactly as it was, rather than half-upgraded.
 *
 * Returns the names of the migrations that were applied.
 */
export async function migrate(
  db: SqlDriver,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<string[]> {
  const current = await getSchemaVersion(db);

  if (current > migrations.length) {
    throw new Error(
      `Database is at schema version ${current} but this build only knows ${migrations.length}. ` +
        'This usually means the app was downgraded; refusing to touch the data.',
    );
  }

  const applied: string[] = [];

  for (let version = current; version < migrations.length; version++) {
    const migration = migrations[version];
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      // Safe to interpolate: `version` is a loop index over our own array.
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    applied.push(migration.name);
  }

  return applied;
}
