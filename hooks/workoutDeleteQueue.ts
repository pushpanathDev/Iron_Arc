import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";
import { workoutApi } from "../services/api";
import { beginWorkoutDelete, cancelWorkoutDelete, finishWorkoutDelete } from "./workoutCache";

/*
 * Deletes with undo, independent of any screen:
 *   schedule → hidden everywhere now, id saved to storage, DELETE after the undo window
 *   undo     → timer cleared, shown again, nothing sent
 *   app goes to background → every pending DELETE is sent immediately (no undo)
 *   app killed mid-window  → ids are still in storage; recoverWorkoutDeletes() sends them on next launch
 * A failed DELETE (other than 404 = already gone) restores the workout and reports it.
 */

export const UNDO_WINDOW_MS = 5000;
const STORAGE_KEY = "@pending_workout_deletes";

type DeletedCallback = (newlyUnlocked: string[]) => void;
type FailureHandler = (id: string, error: unknown) => void;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const onDeleted = new Map<string, DeletedCallback>();
let client: QueryClient | null = null;
let failureHandler: FailureHandler | null = null;
let appStateSubscribed = false;

const log = (msg: string) => {
  if (__DEV__) console.log(`[WorkoutDelete] ${new Date().toISOString()} ${msg}`);
};

/* ---- persisted pending ids (serialised writes so they never clobber each other) ---- */
let storageChain: Promise<unknown> = Promise.resolve();
function updateStored(fn: (ids: string[]) => string[]) {
  storageChain = storageChain
    .then(async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const next = fn(raw ? (JSON.parse(raw) as string[]) : []);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    })
    .catch(() => {});
  return storageChain;
}
export const readStoredDeletes = async () => {
  await storageChain;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
};

function subscribeAppState() {
  if (appStateSubscribed) return;
  appStateSubscribed = true;
  AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "background" || state === "inactive") flushWorkoutDeletes();
  });
}

/** Called once from the root layout: wires the query client and the error toast. */
export function configureWorkoutDeleteQueue(queryClient: QueryClient, onFailure: FailureHandler) {
  client = queryClient;
  failureHandler = onFailure;
  subscribeAppState();
}

async function commit(id: string) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  if (!client) return;
  const qc = client;
  log(`DELETE /api/workouts/${id} sent`);
  try {
    const { newlyUnlocked } = await workoutApi.delete(id);
    log(`DELETE /api/workouts/${id} → 200 OK`);
    finishWorkoutDelete(qc, id);
    onDeleted.get(id)?.(newlyUnlocked ?? []);
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 404) {
      log(`DELETE /api/workouts/${id} → 404 (already gone, treated as deleted)`);
      finishWorkoutDelete(qc, id);
    } else {
      log(`DELETE /api/workouts/${id} → failed (status ${status ?? "network"}); restoring`);
      cancelWorkoutDelete(qc, id);
      failureHandler?.(id, error);
    }
  } finally {
    onDeleted.delete(id);
    await updateStored((ids) => ids.filter((x) => x !== id));
  }
}

/** Hide now; send the DELETE when the undo window closes, whatever screen is open. */
export function scheduleWorkoutDelete(queryClient: QueryClient, id: string, opts?: { onDeleted?: DeletedCallback }) {
  client = client ?? queryClient;
  subscribeAppState();
  if (timers.has(id)) return;
  beginWorkoutDelete(queryClient, id);
  if (opts?.onDeleted) onDeleted.set(id, opts.onDeleted);
  void updateStored((ids) => (ids.includes(id) ? ids : [...ids, id]));
  timers.set(
    id,
    setTimeout(() => void commit(id), UNDO_WINDOW_MS),
  );
  log(`scheduled ${id} (sends in ${UNDO_WINDOW_MS} ms)`);
}

/** Undo within the window. Returns false if it was already sent. */
export function undoWorkoutDelete(queryClient: QueryClient, id: string) {
  const timer = timers.get(id);
  if (!timer) return false;
  clearTimeout(timer);
  timers.delete(id);
  onDeleted.delete(id);
  cancelWorkoutDelete(queryClient, id);
  void updateStored((ids) => ids.filter((x) => x !== id));
  log(`undo ${id} (nothing sent)`);
  return true;
}

/** Send every pending delete now (app going to the background). */
export function flushWorkoutDeletes() {
  const ids = [...timers.keys()];
  if (ids.length) log(`flushing ${ids.length} pending delete(s) immediately`);
  return Promise.all(ids.map((id) => commit(id)));
}

/** Next launch after a kill: re-hide and send deletes that never went out. */
export async function recoverWorkoutDeletes(queryClient: QueryClient) {
  client = client ?? queryClient;
  const ids = (await readStoredDeletes()).filter((id) => !timers.has(id));
  if (!ids.length) return;
  log(`recovering ${ids.length} unsent delete(s) from last session`);
  for (const id of ids) beginWorkoutDelete(queryClient, id);
  await Promise.all(ids.map((id) => commit(id)));
}

/** Test helper: forget in-memory state (simulates a fresh JS runtime). */
export function __resetForTests() {
  timers.forEach(clearTimeout);
  timers.clear();
  onDeleted.clear();
  client = null;
  failureHandler = null;
  appStateSubscribed = false;
  storageChain = Promise.resolve();
}
