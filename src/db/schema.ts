/**
 * Schema migrations.
 *
 * Append-only: never edit or reorder an existing entry, because the index of a
 * migration in this array IS its version number, recorded in the database's
 * `user_version`. To change the schema, add a new entry at the end.
 */

export interface Migration {
  name: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    name: 'initial-schema',
    statements: [
      `CREATE TABLE foods (
         id            TEXT PRIMARY KEY NOT NULL,
         name          TEXT NOT NULL,
         brand         TEXT,
         serving_label TEXT NOT NULL,
         serving_grams REAL,
         kcal          REAL NOT NULL,
         protein_g     REAL NOT NULL,
         carbs_g       REAL NOT NULL,
         fat_g         REAL NOT NULL,
         is_favorite   INTEGER NOT NULL DEFAULT 0,
         created_at    INTEGER NOT NULL
       )`,
      `CREATE INDEX idx_foods_name ON foods (name)`,

      // `kcal`..`fat_g` are a snapshot of the food at log time, deliberately
      // duplicated so that correcting a food later cannot rewrite history.
      // food_id is a soft link only, hence ON DELETE SET NULL.
      `CREATE TABLE food_entries (
         id        TEXT PRIMARY KEY NOT NULL,
         food_id   TEXT REFERENCES foods (id) ON DELETE SET NULL,
         name      TEXT NOT NULL,
         logged_at INTEGER NOT NULL,
         meal      TEXT NOT NULL,
         servings  REAL NOT NULL,
         kcal      REAL NOT NULL,
         protein_g REAL NOT NULL,
         carbs_g   REAL NOT NULL,
         fat_g     REAL NOT NULL
       )`,
      `CREATE INDEX idx_food_entries_logged_at ON food_entries (logged_at)`,

      `CREATE TABLE weight_entries (
         id        TEXT PRIMARY KEY NOT NULL,
         logged_at INTEGER NOT NULL,
         weight_kg REAL NOT NULL,
         note      TEXT
       )`,
      `CREATE INDEX idx_weight_entries_logged_at ON weight_entries (logged_at)`,

      `CREATE TABLE water_entries (
         id        TEXT PRIMARY KEY NOT NULL,
         logged_at INTEGER NOT NULL,
         volume_ml REAL NOT NULL
       )`,
      `CREATE INDEX idx_water_entries_logged_at ON water_entries (logged_at)`,

      // Append-only history: changing your goal today must not restate whether
      // you hit last week's.
      `CREATE TABLE goals (
         id               TEXT PRIMARY KEY NOT NULL,
         effective_from   INTEGER NOT NULL,
         daily_kcal       REAL NOT NULL,
         daily_protein_g  REAL NOT NULL,
         daily_carbs_g    REAL NOT NULL,
         daily_fat_g      REAL NOT NULL,
         daily_water_ml   REAL NOT NULL,
         target_weight_kg REAL,
         target_date      INTEGER
       )`,
      `CREATE INDEX idx_goals_effective_from ON goals (effective_from)`,

      // Profile and unit preferences live here as JSON, keyed by name.
      `CREATE TABLE settings (
         key   TEXT PRIMARY KEY NOT NULL,
         value TEXT NOT NULL
       )`,
    ],
  },
];
