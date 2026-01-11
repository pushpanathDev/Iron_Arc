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

  // Body Weights
  await sqliteDb.runAsync(`
    CREATE TABLE IF NOT EXISTS body_weight (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  date TEXT NOT NULL,
  weight REAL NOT NULL,
  createdAt INTEGER NOT NULL
    )
  `);
}
