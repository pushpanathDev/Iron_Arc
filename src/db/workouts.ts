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
  userId: string;          // 🔐 NEW (mandatory)
  date: string;
  exercise: string;
  category?: string;
  notes?: string;
  createdAt: number;
  sets: WorkoutSet[];
};

/* =========================
   INSERT / UPDATE WORKOUT
   ========================= */
export async function insertWorkout(workout: Workout) {
  await sqliteDb.runAsync(
    `INSERT OR REPLACE INTO workouts 
     (id, userId, date, exercise, category, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      workout.id,
      workout.userId,              // 🔐 store owner
      workout.date,
      workout.exercise,
      workout.category ?? "",
      workout.notes ?? "",
      workout.createdAt,
    ]
  );

  // Clear old sets (important for edits)
  await sqliteDb.runAsync(
    `DELETE FROM workout_sets WHERE workoutId = ?`,
    [workout.id]
  );

  // Insert sets
  for (const set of workout.sets) {
    await sqliteDb.runAsync(
      `INSERT INTO workout_sets (workoutId, reps, weight)
       VALUES (?, ?, ?)`,
      [workout.id, set.reps, set.weight]
    );
  }
}

/* =========================
   READ ALL WORKOUTS (PER USER)
   ========================= */
export async function getAllWorkouts(
  userId: string
): Promise<Workout[]> {
  const workoutRows = await sqliteDb.getAllAsync<{
    id: string;
    userId: string;
    date: string;
    exercise: string;
    category: string;
    notes: string;
    createdAt: number;
  }>(
    `SELECT * FROM workouts 
     WHERE userId = ?
     ORDER BY createdAt DESC`,
    [userId]
  );

  const workouts: Workout[] = [];

  for (const row of workoutRows) {
    const sets = await sqliteDb.getAllAsync<WorkoutSet>(
      `SELECT reps, weight FROM workout_sets WHERE workoutId = ?`,
      [row.id]
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
    });
  }

  return workouts;
}

/* =========================
   DELETE WORKOUT (SAFE)
   ========================= */
export async function deleteWorkoutById(
  id: string,
  userId: string
) {
  // Ensure user can only delete their own data
  await sqliteDb.runAsync(
    `DELETE FROM workout_sets 
     WHERE workoutId IN (
       SELECT id FROM workouts WHERE id = ? AND userId = ?
     )`,
    [id, userId]
  );

  await sqliteDb.runAsync(
    `DELETE FROM workouts WHERE id = ? AND userId = ?`,
    [id, userId]
  );
}
