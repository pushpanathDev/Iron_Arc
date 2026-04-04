import { collection, getDocs } from "firebase/firestore";
import { firestoreDb } from "./config";
import { sqliteDb } from "../db/sqlite";
import { Workout } from "../db/workouts";

import {
  pushWorkoutToFirebase,
  deleteWorkoutFromFirebase,
} from "./workout";

import { setLastSync } from "../db/syncMeta";

/* ======================================================
   PUSH → Firebase (already working, kept as-is)
   ====================================================== */

export async function syncWorkoutAdd(
  userId: string,
  workout: Workout
) {
  try {
    await pushWorkoutToFirebase(userId, workout);
    console.log("☁️ Workout synced to Firebase:", workout.id);
  } catch (e) {
    console.warn("❌ Firebase sync failed (add)", e);
  }
}

export async function syncWorkoutDelete(
  userId: string,
  workoutId: string
) {
  try {
    await deleteWorkoutFromFirebase(userId, workoutId);
    console.log("☁️ Workout deleted from Firebase:", workoutId);
  } catch (e) {
    console.warn("❌ Firebase sync failed (delete)", e);
  }
}

/* ======================================================
   PULL ← Firebase → SQLite (NEW)
   ====================================================== */

export async function syncWorkoutsFromFirebase(userId: string) {
  try {
    console.log("⬇️ Pulling workouts from Firebase for user:", userId);

    if (!firestoreDb) {
      throw new Error("Firestore database not initialized");
    }

    const snap = await getDocs(
      collection(firestoreDb, "users", userId, "workouts")
    );

    // 🔐 USER-ISOLATED: Only delete/replace data for this user
    // First, get all workouts for this user to delete their sets
    const userWorkouts = await sqliteDb.getAllAsync<{ id: string }>(
      `SELECT id FROM workouts WHERE userId = ?`,
      [userId]
    );
    
    // Delete sets for this user's workouts only
    for (const workout of userWorkouts || []) {
      await sqliteDb.runAsync(
        `DELETE FROM workout_sets WHERE workoutId = ?`,
        [workout.id]
      );
    }
    
    // Delete this user's workouts only
    await sqliteDb.runAsync(
      `DELETE FROM workouts WHERE userId = ?`,
      [userId]
    );

    for (const docSnap of snap.docs) {
      const w = docSnap.data();

      // Validate required fields
      if (!w.date || !w.exercise) {
        console.warn("Skipping invalid workout document:", docSnap.id);
        continue;
      }

      await sqliteDb.runAsync(
        `INSERT INTO workouts 
         (id, userId, date, exercise, category, notes, createdAt, isSynced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          docSnap.id,
          userId,
          w.date,
          w.exercise,
          w.category ?? "",
          w.notes ?? "",
          w.createdAt?.toMillis?.() ?? Date.now(),
        ]
      );

      for (const set of w.sets ?? []) {
        if (set?.reps !== undefined && set?.weight !== undefined) {
          await sqliteDb.runAsync(
            `INSERT INTO workout_sets (workoutId, reps, weight)
             VALUES (?, ?, ?)`,
            [docSnap.id, set.reps, set.weight]
          );
        }
      }
    }

    await setLastSync("workouts", Date.now());

    console.log("✅ Firebase → SQLite sync complete for user:", userId);
  } catch (error) {
    console.error("❌ Failed to sync workouts from Firebase:", error);
    throw error; // Re-throw for caller to handle
  }
}
