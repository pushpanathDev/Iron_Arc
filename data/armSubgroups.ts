import { EXERCISES } from "./exercises";

/*
 * The Log picker shows Arms as three tiles. Workouts still save with category
 * "Arms" (history, Analytics, streaks and badges all count Arms), so the
 * split lives only here, as a name → sub-group lookup.
 */

export type ArmSubgroup = "Biceps" | "Triceps" | "Forearms";
export const ARM_SUBGROUPS: ArmSubgroup[] = ["Biceps", "Triceps", "Forearms"];

const BY_SUBGROUP: Record<ArmSubgroup, string[]> = {
  Biceps: [
    "Barbell Curl",
    "EZ Bar Curl",
    "Preacher Curl",
    "Drag Curl",
    "Dumbbell Curl",
    "Hammer Curl",
    "Incline Dumbbell Curl",
    "Concentration Curl",
    "Cross Body Curl",
    "Zottman Curl",
    "Cable Curl",
    "Rope Hammer Curl",
    "Machine Preacher Curl",
  ],
  Triceps: [
    "Close Grip Bench Press",
    "Dips (Triceps)",
    "Diamond Push Ups",
    "Skull Crushers",
    "Overhead Tricep Extension",
    "Dumbbell Kickback",
    "Tricep Pushdown",
    "Rope Pushdown",
    "Reverse Grip Pushdown",
  ],
  Forearms: ["Wrist Curl", "Reverse Wrist Curl", "Reverse Curl", "Plate Pinch", "Dead Hang", "Farmer's Walk"],
};

const LOOKUP = new Map<string, ArmSubgroup>();
for (const sub of ARM_SUBGROUPS) for (const name of BY_SUBGROUP[sub]) LOOKUP.set(name.toLowerCase(), sub);

/** Sub-group of an Arms exercise, or null when it isn't one we know (it then shows under all three). */
export const armSubgroupOf = (name: string): ArmSubgroup | null => LOOKUP.get(name.trim().toLowerCase()) ?? null;

export const isArmSubgroup = (value: string | null | undefined): value is ArmSubgroup =>
  value === "Biceps" || value === "Triceps" || value === "Forearms";

/** Every built-in Arms exercise has a sub-group (kept honest by a unit test). */
export const unassignedArmExercises = () => EXERCISES.Arms.filter((n) => !armSubgroupOf(n));
