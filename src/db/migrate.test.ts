import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getSchemaVersion, migrate } from '@/db/migrate';
import { MIGRATIONS, type Migration } from '@/db/schema';
import { createTestDriver, type TestDriver } from '@/db/test-driver';

let db: TestDriver;

beforeEach(() => {
  db = createTestDriver();
});

afterEach(() => {
  db.close();
});

async function tableExists(name: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [name],
  );
  return row !== null;
}

describe('migrate', () => {
  it('starts at version zero', async () => {
    expect(await getSchemaVersion(db)).toBe(0);
  });

  it('applies every migration and records the version', async () => {
    const applied = await migrate(db);

    expect(applied).toEqual(MIGRATIONS.map((m) => m.name));
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
  });

  it('creates the full schema', async () => {
    await migrate(db);

    for (const table of [
      'foods',
      'food_entries',
      'weight_entries',
      'water_entries',
      'goals',
      'settings',
    ]) {
      expect(await tableExists(table), `${table} should exist`).toBe(true);
    }
  });

  it('is a no-op on an already-migrated database', async () => {
    await migrate(db);
    const applied = await migrate(db);

    expect(applied).toEqual([]);
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
  });

  it('applies only the migrations that are new', async () => {
    await migrate(db);

    const added: Migration[] = [
      ...MIGRATIONS,
      { name: 'add-notes', statements: ['CREATE TABLE notes (id TEXT PRIMARY KEY)'] },
    ];
    const applied = await migrate(db, added);

    expect(applied).toEqual(['add-notes']);
    expect(await tableExists('notes')).toBe(true);
    expect(await getSchemaVersion(db)).toBe(added.length);
  });

  it('rolls back a failed migration entirely', async () => {
    const broken: Migration[] = [
      {
        name: 'half-broken',
        statements: ['CREATE TABLE good (id TEXT)', 'THIS IS NOT VALID SQL'],
      },
    ];

    await expect(migrate(db, broken)).rejects.toThrow();

    // Neither the table nor the version bump should have survived.
    expect(await tableExists('good')).toBe(false);
    expect(await getSchemaVersion(db)).toBe(0);
  });

  it('refuses to run against a newer schema than it knows', async () => {
    await db.execAsync('PRAGMA user_version = 99');

    await expect(migrate(db)).rejects.toThrow(/downgraded/);
  });
});
