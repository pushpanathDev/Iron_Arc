import { sqliteDb } from "./sqlite";

/* =========================
   TYPES
   ========================= */

export type WorkoutSet = {
  reps: number;
  weight: number;
};

export type Workout = {
  id: string;
  userId: string; // 🔐 NEW (mandatory)
  date: string;
  exercise: string;
  category?: string;
  notes?: string;
  createdAt: number;
  sets: WorkoutSet[];
  isSynced?: number; // 0 or 1
  syncError?: string | null;
  isDeleted?: number; // 0 or 1 (soft delete)
};

/* =========================
   INSERT / UPDATE WORKOUT
   ========================= */
export async function insertWorkout(workout: Workout) {
  await sqliteDb.runAsync(
    `INSERT OR REPLACE INTO workouts 
     (id, userId, date, exercise, category, notes, createdAt, isSynced, isDeleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      workout.id,
      workout.userId, // 🔐 store owner
      workout.date,
      workout.exercise,
      workout.category ?? "",
      workout.notes ?? "",
      workout.createdAt,
      workout.isSynced ?? 0, // Not synced by default
      0, // Not deleted
    ],
  );

  // Clear old sets (important for edits)
  await sqliteDb.runAsync(`DELETE FROM workout_sets WHERE workoutId = ?`, [
    workout.id,
  ]);

  // Insert sets
  for (const set of workout.sets) {
    await sqliteDb.runAsync(
      `INSERT INTO workout_sets (workoutId, reps, weight)
       VALUES (?, ?, ?)`,
      [workout.id, set.reps, set.weight],
    );
  }
}

/* =========================
   MARK AS SYNCED / UPDATE SYNC STATUS
   ========================= */

export async function markWorkoutSynced(id: string) {
  await sqliteDb.runAsync(
    `UPDATE workouts SET isSynced = 1, syncError = NULL WHERE id = ?`,
    [id],
  );
}

export async function markWorkoutSyncError(id: string, error: string) {
  await sqliteDb.runAsync(`UPDATE workouts SET syncError = ? WHERE id = ?`, [
    error,
    id,
  ]);
}

/**
 * Reset sync error to allow retry after code fixes
 */
export async function resetWorkoutSyncError(id: string) {
  await sqliteDb.runAsync(
    `UPDATE workouts SET syncError = NULL, isSynced = 0 WHERE id = ?`,
    [id],
  );
}

/**
 * Reset ALL stuck workouts (those with syncError) to allow retry
 */
export async function resetAllFailedWorkouts(userId: string) {
  const result = await sqliteDb.runAsync(
    `UPDATE workouts SET syncError = NULL, isSynced = 0 WHERE userId = ? AND syncError IS NOT NULL`,
    [userId],
  );
  console.log(`🔄 Reset ${result.changes} failed workouts for retry`);
  return result.changes;
}

/* =========================
   SOFT DELETE (for sync tracking)
   ========================= */

export async function softDeleteWorkout(id: string) {
  await sqliteDb.runAsync(
    `UPDATE workouts SET isDeleted = 1, isSynced = 0 WHERE id = ?`,
    [id],
  );
}

/* =========================
   HARD DELETE (only after Firebase confirms)
   ========================= */

export async function hardDeleteWorkout(id: string) {
  await sqliteDb.runAsync(`DELETE FROM workout_sets WHERE workoutId = ?`, [id]);
  await sqliteDb.runAsync(`DELETE FROM workouts WHERE id = ?`, [id]);
}

/* =========================
   READ ALL WORKOUTS (PER USER)
   ========================= */
export async function getAllWorkouts(userId: string): Promise<Workout[]> {
  const workoutRows = await sqliteDb.getAllAsync<{
    id: string;
    userId: string;
    date: string;
    exercise: string;
    category: string;
    notes: string;
    createdAt: number;
    isSynced: number;
    syncError: string | null;
    isDeleted: number;
  }>(
    `SELECT * FROM workouts 
     WHERE userId = ? AND isDeleted = 0
     ORDER BY createdAt DESC`,
    [userId],
  );

  const workouts: Workout[] = [];

  for (const row of workoutRows) {
    const sets = await sqliteDb.getAllAsync<WorkoutSet>(
      `SELECT reps, weight FROM workout_sets WHERE workoutId = ?`,
      [row.id],
    );

    workouts.push({
      id: row.id,
      userId: row.userId,
      date: row.date,
      exercise: row.exercise,
      category: row.category,
      notes: row.notes || undefined,
      createdAt: row.createdAt,
      sets,
      isSynced: row.isSynced,
      syncError: row.syncError,
      isDeleted: row.isDeleted,
    });
  }

  return workouts;
}

/* =========================
   GET UNSYNCED WORKOUTS (for batch sync)
   ========================= */

export async function getUnsyncedWorkouts(userId: string): Promise<Workout[]> {
  const workoutRows = await sqliteDb.getAllAsync<{
    id: string;
    userId: string;
    date: string;
    exercise: string;
    category: string;
    notes: string;
    createdAt: number;
    isSynced: number;
    syncError: string | null;
    isDeleted: number;
  }>(
    `SELECT * FROM workouts 
     WHERE userId = ? AND (isSynced = 0 OR isDeleted = 1)
     ORDER BY createdAt ASC`,
    [userId],
  );

  const workouts: Workout[] = [];

  for (const row of workoutRows) {
    const sets = await sqliteDb.getAllAsync<WorkoutSet>(
      `SELECT reps, weight FROM workout_sets WHERE workoutId = ?`,
      [row.id],
    );

    workouts.push({
      id: row.id,
      userId: row.userId,
      date: row.date,
      exercise: row.exercise,
      category: row.category,
      notes: row.notes || undefined,
      createdAt: row.createdAt,
      sets,
      isSynced: row.isSynced,
      syncError: row.syncError,
      isDeleted: row.isDeleted,
    });
  }

  return workouts;
}

/* =========================
   DELETE WORKOUT (now SOFT DELETE)
   ========================= */
export async function deleteWorkoutById(id: string, userId: string) {
  // Soft delete - mark as deleted, will be synced and hard deleted after Firebase confirms
  await sqliteDb.runAsync(
    `UPDATE workouts SET isDeleted = 1, isSynced = 0 
     WHERE id = ? AND userId = ?`,
    [id, userId],
  );
}

/* =========================
   GET FREQUENTLY USED EXERCISES BY CATEGORY
   ========================= */
export async function getFrequentExercises(
  userId: string,
  category: string,
  limit: number = 5,
): Promise<string[]> {
  const rows = await sqliteDb.getAllAsync<{ exercise: string; count: number }>(
    `SELECT exercise, COUNT(*) as count 
     FROM workouts 
     WHERE userId = ? AND category = ? AND (isDeleted IS NULL OR isDeleted = 0)
     GROUP BY exercise 
     ORDER BY count DESC 
     LIMIT ?`,
    [userId, category, limit],
  );

  return rows.map((row) => row.exercise);
}
