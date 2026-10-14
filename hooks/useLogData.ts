import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { MuscleGroup } from "../components/muscle/musclePaths";
import { getExercisesForCategory } from "../data/exerciseCatalog";
import { armSubgroupOf, isArmSubgroup, type ArmSubgroup } from "../data/armSubgroups";
import type { ExerciseCategory } from "../data/exercises";
import { displayWeightRounded, exerciseIndexFor, type ExerciseHistory, previousSetAt } from "../utils/exerciseHistory";
import type { WeightUnit } from "../utils/unitConversion";
import { useCustomExercises } from "./useExercises";
import type { SetValues } from "./logSession";
import { useAllWorkouts } from "./useWorkouts";

/**
 * Tiles in the Log picker (3×3 grid, in order). Each tile filters the catalog;
 * `category` is what a workout saves. Arms is shown as Biceps / Triceps /
 * Forearms but still saves as "Arms" (see data/armSubgroups). Cardio is left
 * out: the set model is reps × weight only (no duration or distance). Core is
 * stored as "Abs".
 */
export type TileKey = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "forearms" | "legs" | "core" | "fullBody";

export interface LogTile {
  key: TileKey;
  label: string;
  category: ExerciseCategory;
  subgroup?: ArmSubgroup;
  group: MuscleGroup;
}

export const LOG_TILES: LogTile[] = [
  { key: "chest", label: "Chest", category: "Chest", group: "chest" },
  { key: "back", label: "Back", category: "Back", group: "back" },
  { key: "shoulders", label: "Shoulders", category: "Shoulders", group: "shoulders" },
  { key: "biceps", label: "Biceps", category: "Arms", subgroup: "Biceps", group: "biceps" },
  { key: "triceps", label: "Triceps", category: "Arms", subgroup: "Triceps", group: "triceps" },
  { key: "forearms", label: "Forearms", category: "Arms", subgroup: "Forearms", group: "forearms" },
  { key: "legs", label: "Legs", category: "Legs", group: "legs" },
  { key: "core", label: "Core", category: "Abs", group: "core" },
  { key: "fullBody", label: "Full body", category: "Full Body", group: "fullBody" },
];

const TILE_CATEGORIES = [...new Set(LOG_TILES.map((t) => t.category))];

/** Tile for a workout/catalog category (Home's "Suggested next: Arms" opens Biceps). */
export const tileForCategory = (category: string | null | undefined) => LOG_TILES.find((t) => t.category === category) ?? null;

export interface CatalogExercise {
  name: string;
  /** What the workout saves (Arms for all three arm tiles). */
  category: ExerciseCategory;
  /** Biceps / Triceps / Forearms for arm exercises we can place. */
  subgroup?: ArmSubgroup;
  tile: TileKey;
  custom: boolean;
  /** Custom exercise id (for delete). */
  customId?: string;
}

/** Tiles an exercise belongs to: arm exercises we can't place show under all three. */
function tilesFor(category: ExerciseCategory, subgroup: ArmSubgroup | null): LogTile[] {
  if (category !== "Arms") return LOG_TILES.filter((t) => t.category === category);
  return subgroup ? LOG_TILES.filter((t) => t.subgroup === subgroup) : LOG_TILES.filter((t) => t.category === "Arms");
}

/**
 * Built-in catalog (with any cached admin changes) plus the user's custom
 * exercises, grouped by tile. A custom arm exercise is stored with its
 * sub-group as its category ("Biceps"); older ones stored as "Arms" show
 * under all three arm tiles.
 */
export function useExerciseCatalog() {
  const base = useQuery({
    queryKey: ["exerciseCatalog", "log", 2],
    queryFn: async () =>
      Object.fromEntries(await Promise.all(TILE_CATEGORIES.map(async (c) => [c, await getExercisesForCategory(c)] as const))) as Record<
        ExerciseCategory,
        string[]
      >,
    staleTime: Infinity,
  });
  const customs = useCustomExercises();

  return useMemo(() => {
    const byTile = new Map<TileKey, CatalogExercise[]>(LOG_TILES.map((t) => [t.key, []]));
    const seen = new Map<TileKey, Set<string>>(LOG_TILES.map((t) => [t.key, new Set()]));
    const add = (name: string, category: ExerciseCategory, subgroup: ArmSubgroup | null, custom: boolean, customId?: string) => {
      for (const tile of tilesFor(category, subgroup)) {
        const names = seen.get(tile.key)!;
        if (names.has(name.toLowerCase())) continue;
        names.add(name.toLowerCase());
        byTile.get(tile.key)!.push({ name, category, subgroup: tile.subgroup, tile: tile.key, custom, customId });
      }
    };
    for (const category of TILE_CATEGORIES) {
      for (const name of base.data?.[category] ?? []) add(name, category, category === "Arms" ? armSubgroupOf(name) : null, false);
    }
    for (const c of customs.data ?? []) {
      if (isArmSubgroup(c.category)) add(c.name, "Arms", c.category, true, c.id);
      else if (TILE_CATEGORIES.includes(c.category as ExerciseCategory)) add(c.name, c.category as ExerciseCategory, null, true, c.id);
    }

    // Search and "All exercises" list each exercise once (its first tile).
    const all: CatalogExercise[] = [];
    const once = new Set<string>();
    for (const t of LOG_TILES) {
      for (const ex of byTile.get(t.key)!) {
        if (once.has(ex.name.toLowerCase())) continue;
        once.add(ex.name.toLowerCase());
        all.push(ex);
      }
    }
    return { byTile, all, loading: base.isLoading };
  }, [base.data, base.isLoading, customs.data]);
}

const NO_WORKOUTS: never[] = [];

/**
 * Per-exercise history and summaries from the shared workouts cache. Built
 * once per workouts change and shared by every screen (see exerciseIndexFor).
 */
export function useExerciseIndex() {
  const workouts = useAllWorkouts();
  const { index, summaries } = exerciseIndexFor(workouts.data ?? NO_WORKOUTS);
  return { index, summaries, loading: workouts.isLoading };
}

/** "Same set from last time", converted to the session's unit. */
export function historyPrefill(index: Map<string, ExerciseHistory>, unit: WeightUnit) {
  return (name: string, setIndex = 0): SetValues | null => {
    const prev = previousSetAt(index.get(name.trim().toLowerCase()), setIndex);
    return prev ? { weight: displayWeightRounded(prev.weight, unit), reps: prev.reps } : null;
  };
}
