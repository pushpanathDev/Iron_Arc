/*
 * How a plan meets the calendar. A plan's current week is always shown
 * against this calendar week (Monday to Sunday): its Monday is this Monday, a
 * day counts as done once one of its exercises is logged on that date, and a
 * plan whose current week is older than this calendar week is ready for its
 * next week.
 */
import type { Plan, Workout } from "../services/api";
import { addDays, formatDate, getWeekStart } from "./dates";
import { isTrainingDay, type PlanDay } from "./planData";

type PlanJson = { totalWeeks?: number; weeks?: { isDeloadWeek?: boolean }[] } | null | undefined;

/** How many weeks the plan runs: set when it was made, or every week it holds (older plans). */
export function planLength(planData: unknown): number {
  const plan = planData as PlanJson;
  return plan?.totalWeeks ?? plan?.weeks?.length ?? 1;
}

/** Every 4th week of a plan is lighter (about 60% of the usual load). */
export const isLighterWeek = (planData: unknown, week: number) => !!(planData as PlanJson)?.weeks?.[week - 1]?.isDeloadWeek;

const mondayOf = (date: Date) => formatDate(getWeekStart(date));

/** The Monday of the plan's first week; a plan made on a weekend starts the next Monday. */
function firstMonday(createdAt: string): string {
  const created = new Date(createdAt);
  const weekend = created.getDay() === 0 || created.getDay() === 6;
  return weekend ? addDays(mondayOf(created), 7) : mondayOf(created);
}

/** The Monday the plan's current week belongs to. */
export const currentWeekMonday = (plan: Pick<Plan, "createdAt" | "weekNumber">) =>
  addDays(firstMonday(plan.createdAt), 7 * ((plan.weekNumber || 1) - 1));

/** A new calendar week has begun, the plan hasn't moved on yet, and it has a next week. */
export function readyForNextWeek(plan: Pick<Plan, "createdAt" | "weekNumber" | "planData">, today = new Date()): boolean {
  return (plan.weekNumber || 1) < planLength(plan.planData) && mondayOf(today) > currentWeekMonday(plan);
}

/** This calendar week's date ("YYYY-MM-DD") for a weekday: 0 = Monday … 6 = Sunday. */
export const dateOfWeekday = (index: number, today = new Date()) => addDays(mondayOf(today), index);

/** Today as 0 = Monday … 6 = Sunday. */
export const todayWeekday = (today = new Date()) => (today.getDay() + 6) % 7;

/** Case- and punctuation-insensitive key for matching plan exercises to logged ones. */
export const exerciseMatchKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The weekdays (0 = Monday) of this calendar week whose plan session was
 * logged: at least one of its exercises, on that date.
 */
export function doneWeekdays(days: (PlanDay | null)[], workouts: Pick<Workout, "date" | "exercise">[], today = new Date()): Set<number> {
  const loggedOn = new Map<string, Set<string>>();
  for (const w of workouts) {
    const date = w.date.split("T")[0];
    if (!loggedOn.has(date)) loggedOn.set(date, new Set());
    loggedOn.get(date)!.add(exerciseMatchKey(w.exercise));
  }

  const done = new Set<number>();
  days.forEach((day, index) => {
    if (!isTrainingDay(day)) return;
    const logged = loggedOn.get(dateOfWeekday(index, today));
    if (!logged) return;
    const planned = (day.exercises ?? []).flatMap((e) => [e.name, e.exerciseId]).filter((n): n is string => !!n);
    if (planned.some((name) => logged.has(exerciseMatchKey(name)))) done.add(index);
  });
  return done;
}
