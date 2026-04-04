import { sqliteDb } from "./sqlite";

export async function initDB() {
  // Workouts (with sync tracking)
  await sqliteDb.runAsync(`
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      userId TEXT,
      date TEXT,
      exercise TEXT,
      category TEXT,
      notes TEXT,
      createdAt INTEGER,
      isSynced INTEGER DEFAULT 0,
      syncError TEXT DEFAULT NULL,
      isDeleted INTEGER DEFAULT 0
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
      authProvider TEXT,
      height REAL,
      weeklyGoal INTEGER DEFAULT 1,
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

  // Achievements (local tracking for badges)
  await sqliteDb.runAsync(`
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      unlockedAt INTEGER
    )
  `);

  // Custom Exercises (user-defined exercises per category)
  await sqliteDb.runAsync(`
    CREATE TABLE IF NOT EXISTS custom_exercises (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      UNIQUE(userId, category, name)
    )
  `);

  // Drafts removed - using alternative approach

  // 🔄 Run migrations to update existing tables
  await runMigrations();
}

/* ======================================================
   MIGRATIONS (for schema updates on existing databases)
   ====================================================== */

async function runMigrations() {
  const migrations = [
    {
      id: "rebuild_body_weight_table_v2",
      execute: async () => {
        try {
          // Check if body_weight table has the correct schema
          const columns = await sqliteDb.getAllAsync<{ name: string }>(
            `PRAGMA table_info(body_weight)`,
          );

          const hasId = columns.some((c) => c.name === "id");
          const hasDate = columns.some((c) => c.name === "date");
          const hasUserId = columns.some((c) => c.name === "userId");

          // If missing critical columns, rebuild the entire table
          if (!hasId || !hasDate || !hasUserId) {
            console.log(
              "🔄 Rebuilding body_weight table with correct schema...",
            );

            // Create new table with correct schema
            await sqliteDb.runAsync(`
              CREATE TABLE IF NOT EXISTS body_weight_new (
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

            // Try to migrate existing data if any columns exist
            if (columns.length > 0) {
              const hasWeight = columns.some((c) => c.name === "weight");
              const hasCreatedAt = columns.some((c) => c.name === "createdAt");

              if (hasWeight) {
                // Get existing weights and migrate them
                try {
                  const oldData = await sqliteDb.getAllAsync<{
                    weight?: number;
                    createdAt?: number;
                  }>(`SELECT * FROM body_weight`);

                  await sqliteDb.runAsync(`BEGIN TRANSACTION`);
                  try {
                    for (let i = 0; i < oldData.length; i++) {
                      const row = oldData[i];
                      const weight = row.weight ?? 0;
                      const createdAt = row.createdAt ?? Date.now();
                      const date = new Date(createdAt)
                        .toISOString()
                        .split("T")[0];
                      const id = `migrated_${createdAt}_${i}`;

                      await sqliteDb.runAsync(
                        `INSERT OR IGNORE INTO body_weight_new 
                         (id, userId, date, weight, createdAt, isSynced, isDeleted)
                         VALUES (?, ?, ?, ?, ?, 0, 0)`,
                        [id, "migrated_user", date, weight, createdAt],
                      );
                    }
                    await sqliteDb.runAsync(`COMMIT`);
                    console.log(`✅ Migrated ${oldData.length} weight records`);
                  } catch (txError) {
                    await sqliteDb.runAsync(`ROLLBACK`);
                    throw txError;
                  }
                } catch (e) {
                  console.warn("⚠️ Could not migrate old weight data:", e);
                }
              }
            }

            // Drop old table and rename new one
            await sqliteDb.runAsync(`DROP TABLE IF EXISTS body_weight`);
            await sqliteDb.runAsync(
              `ALTER TABLE body_weight_new RENAME TO body_weight`,
            );

            console.log(
              "✅ Migration: Rebuilt body_weight table with correct schema",
            );
          }
        } catch (error) {
          console.error("❌ Failed to rebuild body_weight table:", error);
        }
      },
    },
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
            console.log("✅ Migration: Added isSynced column to body_weight");
          }

          if (!hasSyncError) {
            await sqliteDb.runAsync(
              `ALTER TABLE body_weight ADD COLUMN syncError TEXT DEFAULT NULL`,
            );
            console.log("✅ Migration: Added syncError column to body_weight");
          }

          if (!hasIsDeleted) {
            await sqliteDb.runAsync(
              `ALTER TABLE body_weight ADD COLUMN isDeleted INTEGER DEFAULT 0`,
            );
            console.log("✅ Migration: Added isDeleted column to body_weight");
          }

          const hasWeekStart = columns.some((c) => c.name === "weekStart");
          if (!hasWeekStart) {
            await sqliteDb.runAsync(
              `ALTER TABLE body_weight ADD COLUMN weekStart TEXT DEFAULT NULL`,
            );
            console.log("✅ Migration: Added weekStart column to body_weight");
          }
        } catch (error) {
          console.warn(
            "⚠️ Migration failed (column may already exist):",
            error,
          );
        }
      },
    },
    {
      id: "add_sync_columns_to_workouts",
      execute: async () => {
        try {
          const columns = await sqliteDb.getAllAsync<{ name: string }>(
            `PRAGMA table_info(workouts)`,
          );

          const hasIsSynced = columns.some((c) => c.name === "isSynced");
          const hasSyncError = columns.some((c) => c.name === "syncError");
          const hasIsDeleted = columns.some((c) => c.name === "isDeleted");

          if (!hasIsSynced) {
            await sqliteDb.runAsync(
              `ALTER TABLE workouts ADD COLUMN isSynced INTEGER DEFAULT 0`,
            );
            console.log("✅ Migration: Added isSynced column to workouts");
          }

          if (!hasSyncError) {
            await sqliteDb.runAsync(
              `ALTER TABLE workouts ADD COLUMN syncError TEXT DEFAULT NULL`,
            );
            console.log("✅ Migration: Added syncError column to workouts");
          }

          if (!hasIsDeleted) {
            await sqliteDb.runAsync(
              `ALTER TABLE workouts ADD COLUMN isDeleted INTEGER DEFAULT 0`,
            );
            console.log("✅ Migration: Added isDeleted column to workouts");
          }
        } catch (error) {
          console.warn(
            "⚠️ Migration failed (workout columns may already exist):",
            error,
          );
        }
      },
    },
    {
      id: "add_authProvider_to_user_profiles",
      execute: async () => {
        try {
          const columns = await sqliteDb.getAllAsync<{ name: string }>(
            `PRAGMA table_info(user_profiles)`,
          );

          const hasAuthProvider = columns.some(
            (c) => c.name === "authProvider",
          );

          if (!hasAuthProvider) {
            await sqliteDb.runAsync(
              `ALTER TABLE user_profiles ADD COLUMN authProvider TEXT DEFAULT NULL`,
            );
            console.log(
              "✅ Migration: Added authProvider column to user_profiles",
            );
          }
        } catch (error) {
          console.warn(
            "⚠️ Migration failed (authProvider column may already exist):",
            error,
          );
        }
      },
    },
    {
      id: "add_weeklyGoal_to_user_profiles",
      execute: async () => {
        try {
          const columns = await sqliteDb.getAllAsync<{ name: string }>(
            `PRAGMA table_info(user_profiles)`,
          );

          const hasWeeklyGoal = columns.some((c) => c.name === "weeklyGoal");

          if (!hasWeeklyGoal) {
            await sqliteDb.runAsync(
              `ALTER TABLE user_profiles ADD COLUMN weeklyGoal INTEGER DEFAULT 4`,
            );
            console.log(
              "✅ Migration: Added weeklyGoal column to user_profiles",
            );
          }
        } catch (error) {
          console.warn(
            "⚠️ Migration failed (weeklyGoal column may already exist):",
            error,
          );
        }
      },
    },
    {
      id: "add_userId_to_body_weight",
      execute: async () => {
        try {
          const columns = await sqliteDb.getAllAsync<{ name: string }>(
            `PRAGMA table_info(body_weight)`,
          );

          const hasUserId = columns.some((c) => c.name === "userId");

          if (!hasUserId) {
            await sqliteDb.runAsync(
              `ALTER TABLE body_weight ADD COLUMN userId TEXT DEFAULT NULL`,
            );
            console.log("✅ Migration: Added userId column to body_weight");
          }
        } catch (error) {
          console.warn(
            "⚠️ Migration failed (userId column may already exist):",
            error,
          );
        }
      },
    },
    {
      id: "add_userId_to_workouts",
      execute: async () => {
        try {
          const columns = await sqliteDb.getAllAsync<{ name: string }>(
            `PRAGMA table_info(workouts)`,
          );

          const hasUserId = columns.some((c) => c.name === "userId");

          if (!hasUserId) {
            await sqliteDb.runAsync(
              `ALTER TABLE workouts ADD COLUMN userId TEXT DEFAULT NULL`,
            );
            console.log("✅ Migration: Added userId column to workouts");
          }
        } catch (error) {
          console.warn(
            "⚠️ Migration failed (workouts userId column may already exist):",
            error,
          );
        }
      },
    },
    {
      id: "add_weight_to_user_profiles",
      execute: async () => {
        try {
          const columns = await sqliteDb.getAllAsync<{ name: string }>(
            `PRAGMA table_info(user_profiles)`,
          );

          const hasWeight = columns.some((c) => c.name === "weight");

          if (!hasWeight) {
            await sqliteDb.runAsync(
              `ALTER TABLE user_profiles ADD COLUMN weight REAL DEFAULT NULL`,
            );
            console.log("✅ Migration: Added weight column to user_profiles");
          }
        } catch (error) {
          console.warn(
            "⚠️ Migration failed (weight column may already exist):",
            error,
          );
        }
      },
    },
    {
      id: "add_age_to_user_profiles",
      execute: async () => {
        try {
          const columns = await sqliteDb.getAllAsync<{ name: string }>(
            `PRAGMA table_info(user_profiles)`,
          );

          const hasAge = columns.some((c) => c.name === "age");

          if (!hasAge) {
            await sqliteDb.runAsync(
              `ALTER TABLE user_profiles ADD COLUMN age INTEGER DEFAULT NULL`,
            );
            console.log("✅ Migration: Added age column to user_profiles");
          }
        } catch (error) {
          console.warn(
            "⚠️ Migration failed (age column may already exist):",
            error,
          );
        }
      },
    },
    {
      id: "add_fitnessGoal_to_user_profiles",
      execute: async () => {
        try {
          const columns = await sqliteDb.getAllAsync<{ name: string }>(
            `PRAGMA table_info(user_profiles)`,
          );

          const hasFitnessGoal = columns.some(
            (c) => c.name === "fitnessGoal",
          );

          if (!hasFitnessGoal) {
            await sqliteDb.runAsync(
              `ALTER TABLE user_profiles ADD COLUMN fitnessGoal TEXT DEFAULT NULL`,
            );
            console.log(
              "✅ Migration: Added fitnessGoal column to user_profiles",
            );
          }
        } catch (error) {
          console.warn(
            "⚠️ Migration failed (fitnessGoal column may already exist):",
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
