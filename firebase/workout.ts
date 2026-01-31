import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, firestoreDb } from "./config";
import { syncWorkoutAdd } from "./sync";

/**
 * Sanitize workout data for Firebase
 * Firebase doesn't accept undefined values, convert to null
 * @param userId - The user ID (passed separately to ensure it's always present)
 * @param workout - The workout data
 */
function sanitizeForFirebase(userId: string, workout: any) {
  return {
    id: workout.id,
    userId: userId, // Use parameter, not workout.userId (may be undefined)
    date: workout.date,
    exercise: workout.exercise,
    category: workout.category ?? null,
    notes: workout.notes ?? null,
    createdAt: workout.createdAt,
    sets: workout.sets ?? [],
    isSynced: 1,
  };
}

export async function pushWorkoutToFirebase(
  userId: string,
  workout: any
) {
  if (!firestoreDb) return;

  const ref = doc(
    firestoreDb,
    "users",
    userId,
    "workouts",
    workout.id
  );
  // 👇 PASTE LOGS HERE (TOP OF FUNCTION)
  console.log(
    "🔥 Firebase write path:",
    `users/${userId}/workouts/${workout.id}`
  );
  console.log("🔐 Auth UID:", auth.currentUser?.uid);

  // Sanitize data to avoid undefined values
  const sanitizedWorkout = sanitizeForFirebase(userId, workout);
  await setDoc(ref, sanitizedWorkout, { merge: true });
}

export async function deleteWorkoutFromFirebase(
  userId: string,
  workoutId: string
) {
  if (!firestoreDb) return;

  const ref = doc(
    firestoreDb,
    "users",
    userId,
    "workouts",
    workoutId
  );

  await deleteDoc(ref);
}
