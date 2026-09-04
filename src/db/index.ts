export type { RunResult, SqlDriver, SqlParams, SqlValue } from '@/db/driver';
export { getSchemaVersion, migrate } from '@/db/migrate';
export { DATABASE_NAME, openDatabase, resetDatabaseHandle } from '@/db/open';
export { MIGRATIONS, type Migration } from '@/db/schema';

export * as foods from '@/db/repositories/foods';
export * as foodEntries from '@/db/repositories/food-entries';
export * as goals from '@/db/repositories/goals';
export * as settings from '@/db/repositories/settings';
export * as water from '@/db/repositories/water';
export * as weight from '@/db/repositories/weight';
