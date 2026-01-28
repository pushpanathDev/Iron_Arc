import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, firestoreDb } from "./config";
import { syncWorkoutAdd } from "./sync";

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


  await setDoc(ref, workout, { merge: true });
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
