import type { MuscleGroup } from "../components/muscle/musclePaths";
import type { ArmSubgroup } from "./armSubgroups";
import type { ExerciseCategory } from "./exercises";

/**
 * Tiles in the exercise picker (3×3 grid, in order). Each tile filters the catalog;
 * `category` is what a workout saves. Arms is shown as Biceps / Triceps /
 * Forearms but still saves as "Arms" (see data/armSubgroups). Cardio is left
 * out: the set model is reps × weight only (no duration or distance). Core is
 * stored as "Abs".
 */
export type TileKey = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "forearms" | "legs" | "core" | "fullBody";

export interface PickerTile {
  key: TileKey;
  label: string;
  category: ExerciseCategory;
  subgroup?: ArmSubgroup;
  group: MuscleGroup;
}

export const PICKER_TILES: PickerTile[] = [
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

export const TILE_CATEGORIES = [...new Set(PICKER_TILES.map((t) => t.category))];

/** Tile for a workout/catalog category (Home's "Suggested next: Arms" opens Biceps). */
export const tileForCategory = (category: string | null | undefined) => PICKER_TILES.find((t) => t.category === category) ?? null;

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
export function tilesFor(category: ExerciseCategory, subgroup: ArmSubgroup | null): PickerTile[] {
  if (category !== "Arms") return PICKER_TILES.filter((t) => t.category === category);
  return subgroup ? PICKER_TILES.filter((t) => t.subgroup === subgroup) : PICKER_TILES.filter((t) => t.category === "Arms");
}
