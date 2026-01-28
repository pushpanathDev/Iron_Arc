import { sqliteDb } from "./sqlite";

export async function initDB() {
  // Workouts
  await sqliteDb.runAsync(`
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      userId TEXT,
      date TEXT,
      exercise TEXT,
      category TEXT,
      notes TEXT,
      createdAt INTEGER
    )
  `);

  // Sets
  await sqliteDb.runAsync(`
    CREATE TABLE IF NOT EXISTS workout_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workoutId TEXT,
      reps INTEGER,
      weight INTEGER
    )
  `);

  // ✅ Sync metadata (NEW)
  await sqliteDb.runAsync(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value INTEGER
    )
  `);

  // User Profiles (local-first, read everywhere)
  await sqliteDb.runAsync(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      userId TEXT PRIMARY KEY NOT NULL,
      displayName TEXT,
      email TEXT,
      avatarUrl TEXT,
      height REAL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  // Body Weights (with sync tracking and daily flexibility)
  await sqliteDb.runAsync(`
    CREATE TABLE IF NOT EXISTS body_weight (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  date TEXT NOT NULL,
  weekStart TEXT DEFAULT NULL,
  weight REAL NOT NULL,
  createdAt INTEGER NOT NULL,
  isSynced INTEGER DEFAULT 0,
  syncError TEXT DEFAULT NULL,
  isDeleted INTEGER DEFAULT 0
    )
  `);

  // 🔄 Run migrations to update existing tables
  await runMigrations();
}

/* ======================================================
   MIGRATIONS (for schema updates on existing databases)
   ====================================================== */

async function runMigrations() {
  const migrations = [
    {
      id: "add_sync_columns_to_body_weight",
      execute: async () => {
        try {
          // Check if column exists before adding
          const result = await sqliteDb.getFirstAsync<{ isSynced?: number }>(
            `PRAGMA table_info(body_weight)`,
          );

          // Try to add columns if they don't exist
          const columns = await sqliteDb.getAllAsync<{ name: string }>(
            `PRAGMA table_info(body_weight)`,
          );

          const hasIsSynced = columns.some((c) => c.name === "isSynced");
          const hasSyncError = columns.some((c) => c.name === "syncError");
          const hasIsDeleted = columns.some((c) => c.name === "isDeleted");

          if (!hasIsSynced) {
            await sqliteDb.runAsync(
              `ALTER TABLE body_weight ADD COLUMN isSynced INTEGER DEFAULT 0`,
            );
            console.log("✅ Migration: Added isSynced column");
          }

          if (!hasSyncError) {
            await sqliteDb.runAsync(
              `ALTER TABLE body_weight ADD COLUMN syncError TEXT DEFAULT NULL`,
            );
            console.log("✅ Migration: Added syncError column");
          }

          if (!hasIsDeleted) {
            await sqliteDb.runAsync(
              `ALTER TABLE body_weight ADD COLUMN isDeleted INTEGER DEFAULT 0`,
            );
            console.log("✅ Migration: Added isDeleted column");
          }

          const hasWeekStart = columns.some((c) => c.name === "weekStart");
          if (!hasWeekStart) {
            await sqliteDb.runAsync(
              `ALTER TABLE body_weight ADD COLUMN weekStart TEXT DEFAULT NULL`,
            );
            console.log("✅ Migration: Added weekStart column");
          }
        } catch (error) {
          console.warn(
            "⚠️ Migration failed (column may already exist):",
            error,
          );
        }
      },
    },
  ];

  for (const migration of migrations) {
    try {
      await migration.execute();
    } catch (error) {
      console.error(`❌ Migration ${migration.id} failed:`, error);
    }
  }
}
