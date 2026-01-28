import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { firestoreDb } from "./config";
import { insertWeight, BodyWeight } from "../db/weights";
import { setLastSync } from "../db/syncMeta";

/* ======================================================
   PUSH → Firebase (ADD / UPDATE)
   ====================================================== */
export async function syncWeightAdd(
  userId: string,
  weight: BodyWeight
) {
  await setDoc(
    doc(firestoreDb, "users", userId, "weights", weight.id),
    {
      date: weight.date,
      weight: weight.weight,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  console.log("☁️ Weight synced to Firebase:", weight.id);
}

/* ======================================================
   DELETE → Firebase
   ====================================================== */
export async function syncWeightDelete(
  userId: string,
  weightId: string
) {
  await deleteDoc(
    doc(firestoreDb, "users", userId, "weights", weightId)
  );

  console.log("☁️ Weight deleted from Firebase:", weightId);
}

/* ======================================================
   PULL ← Firebase → SQLite
   ====================================================== */
export async function pullWeightsFromFirebase(userId: string) {
  const q = query(
    collection(firestoreDb, "users", userId, "weights"),
    orderBy("date", "asc")
  );

  const snapshot = await getDocs(q);

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    const weight: BodyWeight = {
      id: docSnap.id,
      userId,
      date: data.date,
      weight: data.weight,
      createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    };

    await insertWeight(weight);
  }

  await setLastSync("weights", Date.now());

  console.log("⬇️ Weights pulled from Firebase");
}
