import type { QueryClient } from "@tanstack/react-query";
import { workoutApi, type Workout } from "../services/api";
import { toKg } from "../utils/unitConversion";
import { formatDate } from "../utils/dates";
import { doneSets, getDraft, updateDraft, writeNow, type WorkoutDraft } from "./workoutDraft";
import { workoutKeys } from "./workoutCache";

/*
 * Saving a session: ONE POST /api/workouts/batch with every exercise that has
 * completed sets. The server saves them in one transaction, so it's all or
 * nothing; on failure the draft stays as it is.
 */

export type SaveResult = { saved: boolean; count: number; newlyUnlocked: string[]; error?: unknown };

export const sessionDate = (d: WorkoutDraft) => d.date ?? formatDate(new Date());

export function batchBody(d: WorkoutDraft) {
  return {
    date: sessionDate(d),
    entries: d.exercises
      .filter((e) => doneSets(e).length > 0)
      .map((e) => ({
        exercise: e.name,
        category: e.category,
        ...(e.notes?.trim() ? { notes: e.notes.trim() } : {}),
        sets: doneSets(e).map((s) => ({ reps: s.reps ?? 0, weight: toKg(s.weight ?? 0, d.unit) })),
      })),
  };
}

/**
 * Duplicate guard: a save whose response was lost (timeout, app killed) may
 * still have committed. Before retrying, check whether every entry is already
 * on the server (same date and exercise, created since the session started,
 * same set count). The batch is all-or-nothing, so it's all there or none.
 */
function alreadySaved(list: Workout[] | undefined, d: WorkoutDraft, body: ReturnType<typeof batchBody>) {
  if (!list) return false;
  return body.entries.every((entry) =>
    list.some(
      (w) =>
        w.date.split("T")[0] === body.date &&
        w.exercise.toLowerCase() === entry.exercise.toLowerCase() &&
        Date.parse(w.createdAt) >= d.startedAt &&
        w.sets.length === entry.sets.length,
    ),
  );
}

export async function saveWorkout(queryClient: QueryClient): Promise<SaveResult> {
  const d = getDraft();
  if (!d) return { saved: false, count: 0, newlyUnlocked: [] };
  const body = batchBody(d);
  if (body.entries.length === 0) return { saved: false, count: 0, newlyUnlocked: [] };

  try {
    if (d.saveStartedAt != null) {
      const list = await queryClient.fetchQuery({ queryKey: workoutKeys.list(), queryFn: () => workoutApi.listAll(), staleTime: 0 });
      if (alreadySaved(list, d, body)) return { saved: true, count: body.entries.length, newlyUnlocked: [] };
    } else {
      updateDraft((s) => ({ ...s, saveStartedAt: Date.now() }));
      await writeNow();
    }
    const res = await workoutApi.createBatch(body);
    return { saved: true, count: res.data.length, newlyUnlocked: res.newlyUnlocked };
  } catch (error) {
    if (__DEV__) {
      const e = error as { status?: number; message?: string };
      console.warn(`[WorkoutSave] POST /api/workouts/batch failed: ${e.status ? `HTTP ${e.status}` : "no response"} ${e.message ?? ""}`);
    }
    return { saved: false, count: 0, newlyUnlocked: [], error };
  } finally {
    void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
  }
}
