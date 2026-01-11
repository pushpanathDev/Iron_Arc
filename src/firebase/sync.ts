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
  console.log("⬇️ Pulling workouts from Firebase...");

  const snap = await getDocs(
    collection(firestoreDb, "users", userId, "workouts")
  );

  // 🔥 IMPORTANT:
  // Firebase is authoritative on pull → replace local cache
  await sqliteDb.runAsync(`DELETE FROM workout_sets`);
  await sqliteDb.runAsync(`DELETE FROM workouts`);

  for (const docSnap of snap.docs) {
    const w = docSnap.data();

    await sqliteDb.runAsync(
      `INSERT INTO workouts 
       (id, userId, date, exercise, category, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
      await sqliteDb.runAsync(
        `INSERT INTO workout_sets (workoutId, reps, weight)
         VALUES (?, ?, ?)`,
        [docSnap.id, set.reps, set.weight]
      );
    }
  }

  await setLastSync("workouts", Date.now());

  console.log("✅ Firebase → SQLite sync complete");
}
