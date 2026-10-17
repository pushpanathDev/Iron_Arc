/*
 * How a plan meets the calendar. Plan weeks are calendar weeks, Monday to
 * Sunday: each week knows its Monday (weekStartsOn), a day counts as done once
 * one of its exercises is logged on that day's date, and the next week can
 * start from the Monday after (the coach writes it then, from the whole week).
 */
import type { Plan, Workout } from "../services/api";
import { addDays, formatDate, getWeekStart } from "./dates";
import { isTrainingDay, type PlanDay } from "./planData";

type PlanJson = { totalWeeks?: number; weekStartsOn?: string; weekStartedAt?: string; weeks?: { isDeloadWeek?: boolean }[] } | null | undefined;

/** How many weeks the plan runs: set when it was made, or every week it holds (older plans). */
export function planLength(planData: unknown): number {
  const plan = planData as PlanJson;
  return plan?.totalWeeks ?? plan?.weeks?.length ?? 1;
}

/** Every 4th week of a plan is lighter (about 60% of the usual load). */
export const isLighterWeek = (planData: unknown, week: number) => !!(planData as PlanJson)?.weeks?.[week - 1]?.isDeloadWeek;

/** Monday ("YYYY-MM-DD") of the calendar week a date is in. */
export const mondayOf = (date: Date) => formatDate(getWeekStart(date));

/** Week 1's Monday for a plan made at `date`: that week's, or the next week's when made at the weekend. */
function firstMonday(date: Date): string {
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  return weekend ? addDays(mondayOf(date), 7) : mondayOf(date);
}

/**
 * The Monday of the plan's current week. The server stores it on each week;
 * plans from before that have their week's start time, or count weeks from
 * when they were made.
 */
export function weekStartsOn(plan: Pick<Plan, "createdAt" | "weekNumber" | "planData">): string {
  const data = plan.planData as PlanJson;
  if (data?.weekStartsOn) return data.weekStartsOn;
  if (data?.weekStartedAt) return mondayOf(new Date(data.weekStartedAt));
  return addDays(firstMonday(new Date(plan.createdAt)), 7 * ((plan.weekNumber || 1) - 1));
}

/** The Monday the next plan week can start. */
export const nextWeekStartsOn = (plan: Pick<Plan, "createdAt" | "weekNumber" | "planData">) => addDays(weekStartsOn(plan), 7);

/** The plan has a next week, and its Monday has come. */
export function readyForNextWeek(plan: Pick<Plan, "createdAt" | "weekNumber" | "planData">, today = new Date()): boolean {
  return (plan.weekNumber || 1) < planLength(plan.planData) && mondayOf(today) >= nextWeekStartsOn(plan);
}

/** The date ("YYYY-MM-DD") of a weekday in the week starting `monday`: 0 = Monday … 6 = Sunday. */
export const dateOfWeekday = (index: number, monday: string) => addDays(monday, index);

/** Today as 0 = Monday … 6 = Sunday. */
export const todayWeekday = (today = new Date()) => (today.getDay() + 6) % 7;

/** Case- and punctuation-insensitive key for matching plan exercises to logged ones. */
export const exerciseMatchKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The weekdays (0 = Monday) of the plan week starting `monday` whose session
 * was logged: at least one of its exercises, on that day's date.
 */
export function doneWeekdays(days: (PlanDay | null)[], workouts: Pick<Workout, "date" | "exercise">[], monday: string): Set<number> {
  const loggedOn = new Map<string, Set<string>>();
  for (const w of workouts) {
    const date = w.date.split("T")[0];
    if (!loggedOn.has(date)) loggedOn.set(date, new Set());
    loggedOn.get(date)!.add(exerciseMatchKey(w.exercise));
  }

  const done = new Set<number>();
  days.forEach((day, index) => {
    if (!isTrainingDay(day)) return;
    const logged = loggedOn.get(dateOfWeekday(index, monday));
    if (!logged) return;
    const planned = (day.exercises ?? []).flatMap((e) => [e.name, e.exerciseId]).filter((n): n is string => !!n);
    if (planned.some((name) => logged.has(exerciseMatchKey(name)))) done.add(index);
  });
  return done;
}
