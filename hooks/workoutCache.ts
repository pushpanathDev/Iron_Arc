import type { QueryClient } from "@tanstack/react-query";
import type { Workout } from "../services/api";

/** Every workout query lives under ["workouts", ...] so one invalidation refreshes them all. */
export const workoutKeys = {
  all: ["workouts"] as const,
  /** Full history (all pages): the single source for Home, History, Analytics. */
  list: () => ["workouts", "all"] as const,
  stats: () => ["workouts", "stats"] as const,
  page: (params?: Record<string, unknown>) => ["workouts", "page", params ?? {}] as const,
  detail: (id: string) => ["workouts", "detail", id] as const,
};

/*
 * Workouts the user deleted that the server hasn't confirmed yet. They're
 * filtered out of the shared list via `select`, so every screen hides them
 * at once and a background refetch during the undo window can't bring
 * them back.
 */
const pendingDeletes = new Set<string>();
/** Dev only: ids confirmed deleted, to check the server never returns them again. */
const confirmedDeletes = new Set<string>();

export const isPendingDelete = (id: string) => pendingDeletes.has(id);

export const hidePendingDeletes = (rows: Workout[]) =>
  pendingDeletes.size === 0 ? rows : rows.filter((w) => !pendingDeletes.has(w.id));

/** Re-run every list `select` (new array, same contents) without changing "last synced". */
function touchList(queryClient: QueryClient) {
  const updatedAt = queryClient.getQueryState(workoutKeys.list())?.dataUpdatedAt;
  queryClient.setQueryData<Workout[]>(workoutKeys.list(), (old) => (old ? [...old] : old), { updatedAt });
}

export function beginWorkoutDelete(queryClient: QueryClient, id: string) {
  pendingDeletes.add(id);
  touchList(queryClient);
}

export function cancelWorkoutDelete(queryClient: QueryClient, id: string) {
  pendingDeletes.delete(id);
  touchList(queryClient);
}

/** Server confirmed (or it was already gone): drop it from every cache and refetch. */
export function finishWorkoutDelete(queryClient: QueryClient, id: string) {
  const updatedAt = queryClient.getQueryState(workoutKeys.list())?.dataUpdatedAt;
  queryClient.setQueryData<Workout[]>(workoutKeys.list(), (old) => (old ? old.filter((w) => w.id !== id) : old), { updatedAt });
  queryClient.removeQueries({ queryKey: workoutKeys.detail(id) });
  pendingDeletes.delete(id);
  if (__DEV__) confirmedDeletes.add(id);
  void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
}

/** Dev only: log what the list endpoint returned and whether any deleted id came back. */
export function logWorkoutListResponse(rows: Workout[]) {
  if (!__DEV__) return;
  const resurrected = rows.filter((w) => confirmedDeletes.has(w.id)).map((w) => w.id);
  console.log(
    `[Workouts] GET /api/workouts (all pages) → ${rows.length} rows; ` +
      `deleted ids in response: ${resurrected.length ? resurrected.join(", ") : "none"}`,
  );
}
