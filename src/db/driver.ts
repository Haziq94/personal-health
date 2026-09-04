/**
 * The slice of a SQLite connection this app actually uses.
 *
 * Declaring it as an interface rather than importing `expo-sqlite` everywhere
 * keeps the repositories runnable under plain Node, so migrations and queries
 * can be tested against real SQLite instead of a mock.
 */

export type SqlValue = string | number | null;
export type SqlParams = readonly SqlValue[];

export interface RunResult {
  changes: number;
}

export interface SqlDriver {
  /** Runs one or more statements. No parameters, no result. */
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParams): Promise<RunResult>;
  getAllAsync<T>(sql: string, params?: SqlParams): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParams): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
