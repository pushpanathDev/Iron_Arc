import { useMemo } from "react";
import { armSubgroupOf, isArmSubgroup, type ArmSubgroup } from "../data/armSubgroups";
import { EXERCISES, type ExerciseCategory } from "../data/exercises";
import { displayWeightRounded, exerciseIndexFor, type ExerciseHistory, previousSetAt } from "../utils/exerciseHistory";
import type { WeightUnit } from "../utils/unitConversion";
import { PICKER_TILES, TILE_CATEGORIES, tilesFor, type CatalogExercise, type TileKey } from "../data/pickerTiles";
import { useCustomExercises } from "./useExercises";
import type { SetValues } from "./workoutDraft";
import { useAllWorkouts } from "./useWorkouts";


/**
 * Built-in catalog plus the user's custom
 * exercises, grouped by tile. A custom arm exercise is stored with its
 * sub-group as its category ("Biceps"); older ones stored as "Arms" show
 * under all three arm tiles.
 */
export function useExerciseCatalog() {
  const customs = useCustomExercises();

  return useMemo(() => {
    const byTile = new Map<TileKey, CatalogExercise[]>(PICKER_TILES.map((t) => [t.key, []]));
    const seen = new Map<TileKey, Set<string>>(PICKER_TILES.map((t) => [t.key, new Set()]));
    const add = (name: string, category: ExerciseCategory, subgroup: ArmSubgroup | null, custom: boolean, customId?: string) => {
      for (const tile of tilesFor(category, subgroup)) {
        const names = seen.get(tile.key)!;
        if (names.has(name.toLowerCase())) continue;
        names.add(name.toLowerCase());
        byTile.get(tile.key)!.push({ name, category, subgroup: tile.subgroup, tile: tile.key, custom, customId });
      }
    };
    for (const category of TILE_CATEGORIES) {
      for (const name of EXERCISES[category] ?? []) add(name, category, category === "Arms" ? armSubgroupOf(name) : null, false);
    }
    for (const c of customs.data ?? []) {
      if (isArmSubgroup(c.category)) add(c.name, "Arms", c.category, true, c.id);
      else if (TILE_CATEGORIES.includes(c.category as ExerciseCategory)) add(c.name, c.category as ExerciseCategory, null, true, c.id);
    }

    // Search and "All exercises" list each exercise once (its first tile).
    const all: CatalogExercise[] = [];
    const once = new Set<string>();
    for (const t of PICKER_TILES) {
      for (const ex of byTile.get(t.key)!) {
        if (once.has(ex.name.toLowerCase())) continue;
        once.add(ex.name.toLowerCase());
        all.push(ex);
      }
    }
    return { byTile, all };
  }, [customs.data]);
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
