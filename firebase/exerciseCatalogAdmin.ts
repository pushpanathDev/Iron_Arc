import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { firestoreDb } from "./config";

export type AdminExerciseCatalog = {
  mode: "merge" | "replace";
  categories: Record<string, string[]>;
  removed: Record<string, string[]>;
  updatedAt?: number;
};

const CATALOG_DOC = doc(firestoreDb, "exerciseCatalog", "v1");

export async function getExerciseCatalogAdmin(): Promise<AdminExerciseCatalog> {
  const snap = await getDoc(CATALOG_DOC);
  if (!snap.exists()) {
    return {
      mode: "merge",
      categories: {},
      removed: {},
    };
  }
  const data = snap.data() as AdminExerciseCatalog;
  return {
    mode: data.mode === "replace" ? "replace" : "merge",
    categories: data.categories ?? {},
    removed: data.removed ?? {},
    updatedAt:
      typeof data.updatedAt === "number" ? data.updatedAt : undefined,
  };
}

export async function saveExerciseCatalogAdmin(
  catalog: AdminExerciseCatalog,
): Promise<void> {
  await setDoc(
    CATALOG_DOC,
    {
      mode: catalog.mode,
      categories: catalog.categories,
      removed: catalog.removed,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
