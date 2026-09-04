/**
 * A `SqlDriver` backed by Node's built-in SQLite.
 *
 * TEST ONLY. Nothing under `src/app` may import this — it pulls in `node:sqlite`,
 * which does not exist in the React Native runtime. It exists so migrations and
 * queries can be exercised against a real SQLite engine rather than a mock.
 */

import { DatabaseSync } from 'node:sqlite';

import type { RunResult, SqlDriver, SqlParams } from '@/db/driver';

export interface TestDriver extends SqlDriver {
  close(): void;
}

export function createTestDriver(): TestDriver {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  let inTransaction = false;

  return {
    async execAsync(sql: string): Promise<void> {
      db.exec(sql);
    },

    async runAsync(sql: string, params: SqlParams = []): Promise<RunResult> {
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result.changes) };
    },

    async getAllAsync<T>(sql: string, params: SqlParams = []): Promise<T[]> {
      return db.prepare(sql).all(...params) as T[];
    },

    async getFirstAsync<T>(sql: string, params: SqlParams = []): Promise<T | null> {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },

    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
      // expo-sqlite rejects nested transactions too; matching that keeps the
      // test driver honest rather than more permissive than the real one.
      if (inTransaction) {
        throw new Error('Nested transactions are not supported');
      }
      inTransaction = true;
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        inTransaction = false;
      }
    },

    close(): void {
      db.close();
    },
  };
}
