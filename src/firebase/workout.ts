import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { firestoreDb } from "./config";

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
