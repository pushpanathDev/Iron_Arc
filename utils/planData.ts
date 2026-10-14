import { EXERCISES, type ExerciseCategory } from "../data/exercises";
import type { Plan } from "../services/api";
import { WEIGHT_HINTS, weightHintFor } from "./weightEntry";

/*
 * Reading AI plans (planData is the model's JSON: weeks → days → exercises).
 * Shared by Home, the plan list and the day view so they always agree.
 */

export interface PlanExercise {
  exerciseId?: string;
  name?: string;
  sets?: number;
  reps?: string;
  restSeconds?: number;
  targetWeight_kg?: number | null;
  progressionNote?: string;
  substitutes?: string[];
  substitutedFrom?: string;
}

export interface PlanDay {
  /** "monday" … "sunday" */
  day?: string;
  name?: string;
  sessionType?: "training" | "rest";
  targetMuscles?: string[];
  estimatedDurationMinutes?: number;
  recoveryNote?: string;
  exercises?: PlanExercise[];
}

type PlanJson = { weeks?: { week?: number; days?: PlanDay[] }[]; days?: PlanDay[]; planExplanation?: string } | null | undefined;

export const WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

/** The plan's days for a week (1-based), clamped to the weeks it has. */
export function getPlanWeekDays(planData: unknown, weekNumber: number | undefined): PlanDay[] {
  const data = planData as PlanJson;
  if (Array.isArray(data?.weeks) && data.weeks.length > 0) {
    const index = Math.min(Math.max((weekNumber ?? 1) - 1, 0), data.weeks.length - 1);
    return data.weeks[index]?.days ?? [];
  }
  return Array.isArray(data?.days) ? data.days : [];
}

export const planWeekCount = (planData: unknown) => {
  const data = planData as PlanJson;
  return Array.isArray(data?.weeks) ? data.weeks.length : 1;
};

/** Monday-first: the plan's day for each weekday (or null when it has none). */
export function daysByWeekday(days: PlanDay[]): (PlanDay | null)[] {
  return WEEKDAY_KEYS.map((k) => days.find((d) => d.day?.toLowerCase() === k) ?? null);
}

export const isTrainingDay = (d: PlanDay | null | undefined): d is PlanDay => !!d && d.sessionType !== "rest" && (d.exercises?.length ?? 0) > 0;

export function isRestDayTitle(note: string): boolean {
  const normalized = note.toLowerCase().replace(/[^a-z ]/g, "").trim();
  return normalized === "rest" || normalized === "rest day";
}

export function formatMuscles(muscles: string[] | undefined): string {
  if (!muscles || muscles.length === 0) return "";
  const list = muscles.map((m) => m.toLowerCase());
  const joined = list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** "Push", "Legs", "Upper": a short session name from its muscles (or the plan's own name). */
export function planDayShortName(day: PlanDay): string {
  if (day.name) return day.name;
  const m = new Set((day.targetMuscles ?? []).map((x) => x.toLowerCase()));
  const has = (...keys: string[]) => keys.some((k) => m.has(k));
  const push = has("chest", "triceps") && !has("back", "biceps", "lats");
  const pull = has("back", "lats", "biceps") && !has("chest", "triceps");
  const legs = has("legs", "quads", "hamstrings", "glutes", "calves") && !has("chest", "back", "shoulders");
  const upper = has("chest") && has("back");
  if (legs) return "Legs";
  if (push) return "Push";
  if (pull) return "Pull";
  if (upper && !has("legs", "quads", "hamstrings", "glutes")) return "Upper";
  if (upper) return "Full body";
  return (day.targetMuscles ?? []).slice(0, 2).map(cap).join("/") || "Workout";
}

export const daySetCount = (day: PlanDay) => (day.exercises ?? []).reduce((n, e) => n + (e.sets ?? 0), 0);

/** Training days, session length and explanation for a plan card. */
export function planSummary(plan: Plan) {
  const days = getPlanWeekDays(plan.planData, plan.weekNumber);
  const training = days.filter(isTrainingDay);
  const minutes = training.map((d) => d.estimatedDurationMinutes).find((m): m is number => typeof m === "number") ?? plan.criteria?.sessionDuration ?? null;
  const explanation = ((plan.planData as PlanJson)?.planExplanation ?? "").trim();
  return { trainingDays: training.length, minutes, explanation };
}

/** "Chest · Barbell": the catalogue group and the equipment the name implies (only what we know). */
export function exerciseTags(name: string): string {
  const lower = name.trim().toLowerCase();
  const group = (Object.keys(EXERCISES) as ExerciseCategory[]).find((c) => EXERCISES[c].some((e) => e.toLowerCase() === lower));
  const hint = weightHintFor(name);
  const equipment =
    hint === WEIGHT_HINTS.bar
      ? "Barbell"
      : hint === WEIGHT_HINTS.dumbbell
        ? "Dumbbell"
        : hint === WEIGHT_HINTS.kettlebell
          ? "Kettlebell"
          : hint === WEIGHT_HINTS.cable || hint === WEIGHT_HINTS.twoCables
            ? "Cable"
            : hint === WEIGHT_HINTS.machine
              ? "Machine"
              : hint === WEIGHT_HINTS.bodyweight
                ? "Bodyweight"
                : null;
  return [group === "Abs" ? "Core" : group, equipment].filter(Boolean).join(" · ");
}

/** "2 min", "90 s" */
export function restLabel(seconds: number | undefined): string | null {
  if (!seconds) return null;
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;
}
