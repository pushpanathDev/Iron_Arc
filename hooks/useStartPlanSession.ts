import { router } from "expo-router";
import { useCallback } from "react";
import { useAuth } from "../providers/AuthContext";
import { armSubgroupOf } from "../data/armSubgroups";
import { EXERCISES, type ExerciseCategory } from "../data/exercises";
import { formatDate } from "../utils/dates";
import { addExercises, beginDraft, createDraft, getDraft, setDate, updateDraft, type NewExercise } from "./workoutDraft";
import { historyPrefill, useExerciseIndex } from "./useWorkoutData";
import { useUnitPreference } from "./useUnitPreference";

export interface PlanSessionExercise {
  name?: string;
  sets?: number;
  restSeconds?: number;
  /** Known category (e.g. repeating a logged session); otherwise looked up. */
  category?: string;
}

const MUSCLE_TO_CATEGORY: Record<string, ExerciseCategory> = {
  chest: "Chest",
  pecs: "Chest",
  back: "Back",
  lats: "Back",
  traps: "Back",
  shoulders: "Shoulders",
  delts: "Shoulders",
  quads: "Legs",
  hamstrings: "Legs",
  glutes: "Legs",
  calves: "Legs",
  legs: "Legs",
  biceps: "Arms",
  triceps: "Arms",
  forearms: "Arms",
  arms: "Arms",
  abs: "Abs",
  core: "Abs",
  obliques: "Abs",
};

/** Catalog category for a plan exercise; else the day's first target muscle; else Full Body. */
export function categoryForPlanExercise(name: string, targetMuscles: string[] = []): ExerciseCategory {
  const lower = name.toLowerCase();
  const fromCatalog = (Object.keys(EXERCISES) as ExerciseCategory[]).find((c) => EXERCISES[c].some((e) => e.toLowerCase() === lower));
  if (fromCatalog) return fromCatalog;
  return targetMuscles.map((m) => MUSCLE_TO_CATEGORY[m.toLowerCase()]).find(Boolean) ?? "Full Body";
}

/**
 * Home's Start / Continue workout, the plan's Start and History's Repeat: opens
 * the session with the (remaining) exercises in order, each with its planned
 * number of empty sets. `date` ("YYYY-MM-DD") logs it on an earlier day, e.g.
 * Monday's plan session done on Monday but logged later. A session already in
 * progress is reopened instead of replaced.
 */
export function useStartPlanSession() {
  const { user } = useAuth();
  const { unit } = useUnitPreference();
  const { index } = useExerciseIndex();

  return useCallback(
    (exercises: PlanSessionExercise[], targetMuscles: string[] = [], date?: string) => {
      if (!user) return;
      const existing = getDraft();
      if (!existing || existing.userId !== user.uid || existing.exercises.length === 0) {
        const items: NewExercise[] = exercises
          .filter((e): e is PlanSessionExercise & { name: string } => !!e.name)
          .map((e) => ({
            name: e.name,
            category: e.category ?? categoryForPlanExercise(e.name, targetMuscles),
            subgroup: (e.category ?? categoryForPlanExercise(e.name, targetMuscles)) === "Arms" ? (armSubgroupOf(e.name) ?? undefined) : undefined,
            plannedSets: e.sets,
            restSeconds: e.restSeconds,
          }));
        beginDraft(createDraft(user.uid, unit));
        updateDraft((d) => addExercises(d, items, historyPrefill(index, unit)));
        // The draft treats no date as today.
        if (date && date !== formatDate(new Date())) updateDraft((d) => setDate(d, date));
      }
      router.push("/workout/session");
    },
    [user, unit, index],
  );
}
