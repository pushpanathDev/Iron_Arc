import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";
import { firestoreDb } from "../firebase/config";
import { EXERCISES, ExerciseCategory } from "./exercises";

const CACHE_KEY = "@exercise_catalog_v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type ExerciseCatalogDoc = {
  updatedAt?: number | { toMillis?: () => number };
  categories?: Record<string, string[]>;
  removed?: Record<string, string[]>;
  mode?: "merge" | "replace";
};

type CachedExerciseCatalog = {
  updatedAt: number;
  categories: Record<string, string[]>;
  removed: Record<string, string[]>;
  mode: "merge" | "replace";
};

function normalizeList(list: string[] | undefined): string[] {
  if (!list || list.length === 0) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of list) {
    const item = String(raw).trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizeCatalog(docData: ExerciseCatalogDoc): CachedExerciseCatalog {
  const categories: Record<string, string[]> = {};
  const removed: Record<string, string[]> = {};

  const rawCategories = docData.categories ?? {};
  for (const key of Object.keys(rawCategories)) {
    categories[key] = normalizeList(rawCategories[key]);
  }

  const rawRemoved = docData.removed ?? {};
  for (const key of Object.keys(rawRemoved)) {
    removed[key] = normalizeList(rawRemoved[key]);
  }

  const updatedAtRaw = docData.updatedAt as any;
  const updatedAt =
    typeof updatedAtRaw === "number"
      ? updatedAtRaw
      : updatedAtRaw?.toMillis?.() ?? Date.now();

  return {
    updatedAt,
    categories,
    removed,
    mode: docData.mode === "replace" ? "replace" : "merge",
  };
}

async function getCachedCatalog(): Promise<CachedExerciseCatalog | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedExerciseCatalog;
    if (!parsed?.categories) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function setCachedCatalog(catalog: CachedExerciseCatalog) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(catalog));
  } catch {
    // Ignore cache write failures; fallback to local list
  }
}

async function fetchRemoteCatalog(): Promise<CachedExerciseCatalog | null> {
  try {
    const snap = await getDoc(doc(firestoreDb, "exerciseCatalog", "v1"));
    if (!snap.exists()) return null;
    const catalog = normalizeCatalog(snap.data() as ExerciseCatalogDoc);
    await setCachedCatalog(catalog);
    return catalog;
  } catch {
    return null;
  }
}

function applyRemovals(
  list: string[],
  removed: string[] | undefined,
): string[] {
  if (!removed || removed.length === 0) return list;
  const removedSet = new Set(removed.map((r) => r.toLowerCase()));
  return list.filter((item) => !removedSet.has(item.toLowerCase()));
}

export function mergeExerciseLists(
  base: string[],
  remote: string[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const add = (items: string[]) => {
    for (const raw of items) {
      const item = String(raw).trim();
      if (!item) continue;
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
  };
  add(base);
  add(remote);
  return result;
}

export async function getExercisesForCategory(
  category: ExerciseCategory,
): Promise<string[]> {
  const base = EXERCISES[category] ?? [];

  const cached = await getCachedCatalog();
  const remote = cached?.categories?.[category] ?? [];
  const removed = cached?.removed?.[category] ?? [];

  const list =
    cached?.mode === "replace" && remote.length > 0
      ? remote
      : mergeExerciseLists(base, remote);

  return applyRemovals(list, removed);
}

export async function refreshExercisesForCategory(
  category: ExerciseCategory,
): Promise<string[] | null> {
  const cached = await getCachedCatalog();
  const isStale =
    !cached || Date.now() - cached.updatedAt > CACHE_TTL_MS;

  if (!isStale) {
    return getExercisesForCategory(category);
  }

  const remote = await fetchRemoteCatalog();
  if (!remote) {
    return cached ? getExercisesForCategory(category) : null;
  }

  const list =
    remote.mode === "replace" && remote.categories[category]?.length
      ? remote.categories[category]
      : mergeExerciseLists(
          EXERCISES[category] ?? [],
          remote.categories[category] ?? [],
        );

  return applyRemovals(list, remote.removed?.[category]);
}

export async function refreshExerciseCatalogOnLaunch(): Promise<void> {
  await fetchRemoteCatalog();
}
