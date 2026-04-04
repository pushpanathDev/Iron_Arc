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
  try {
    if (!firestoreDb) {
      throw new Error("Firestore database not initialized");
    }
    
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
  } catch (error) {
    console.error("Failed to sync weight to Firebase:", error);
    throw error; // Re-throw for caller to handle
  }
}

/* ======================================================
   DELETE → Firebase
   ====================================================== */
export async function syncWeightDelete(
  userId: string,
  weightId: string
) {
  try {
    if (!firestoreDb) {
      throw new Error("Firestore database not initialized");
    }
    
    await deleteDoc(
      doc(firestoreDb, "users", userId, "weights", weightId)
    );

    console.log("☁️ Weight deleted from Firebase:", weightId);
  } catch (error) {
    console.error("Failed to delete weight from Firebase:", error);
    throw error; // Re-throw for caller to handle
  }
}

/* ======================================================
   PULL ← Firebase → SQLite
   ====================================================== */
export async function pullWeightsFromFirebase(userId: string) {
  try {
    if (!firestoreDb) {
      throw new Error("Firestore database not initialized");
    }
    
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
        date: data.date || new Date().toISOString(),
        weight: data.weight ?? 0,
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
        isSynced: 1, // Mark as synced since it came from Firebase
      };

      await insertWeight(weight);
    }

    await setLastSync("weights", Date.now());

    console.log("⬇️ Weights pulled from Firebase");
  } catch (error) {
    console.error("Failed to pull weights from Firebase:", error);
    throw error; // Re-throw for caller to handle
  }
}
