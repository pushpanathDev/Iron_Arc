import { useMemo } from "react";
import type { ExerciseCategory } from "../data/exercises";
import type { Workout } from "../services/api";
import { addDays, formatDate, getWeekStart, parseLocalDate, daysBetween } from "../utils/dates";
import { useAllWorkouts } from "./useWorkouts";

/*
 * Everything Home shows about training history, derived from the one shared
 * workouts query (["workouts", "all"]). No separate cached copies, so a
 * create, edit or delete anywhere updates every number at once.
 */

/** One session: workouts on one day with no 3-hour gap between logs (inferred; there's no session id). */
export interface Session {
  date: string;
  /** 1-based position in the user's all-time history. */
  number: number;
  exercises: string[];
  categories: string[];
  /** Category with the most workout records in the session. */
  mainCategory: string;
  sets: number;
  volumeKg: number;
}

export interface WeekSummary {
  /** Monday..Sunday date keys of the current calendar week. */
  dates: string[];
  trained: boolean[];
  daysTrained: number;
  goal: number | null;
  /** round(days / goal × 100), capped at 100. */
  percent: number | null;
  met: boolean;
  /** Training days still needed this week (0 once met). */
  remaining: number;
}

/** Volume (kg) this calendar week vs the same days of last week (Mon..today). */
export interface WeekVolume {
  thisWeekKg: number;
  lastWeekSameSpanKg: number;
  /** Rounded % change, or null when last week had nothing to compare with. */
  changePct: number | null;
}

export interface StreakSummary {
  /** Consecutive weeks meeting the goal; this week counts once met. */
  current: number;
  /** Longest run in the user's full history (same rule). */
  best: number;
}

const SESSION_GAP_MS = 3 * 60 * 60 * 1000;

/** Suggestion order also breaks ties. "Core" is stored as the Abs category. */
export const SUGGEST_GROUPS: { label: string; category: ExerciseCategory }[] = [
  { label: "Chest", category: "Chest" },
  { label: "Back", category: "Back" },
  { label: "Legs", category: "Legs" },
  { label: "Shoulders", category: "Shoulders" },
  { label: "Arms", category: "Arms" },
  { label: "Core", category: "Abs" },
];

const MAX_RECENT = 3;

const weekKeyOf = (dateKey: string) => formatDate(getWeekStart(parseLocalDate(dateKey)));
const dayKey = (w: Workout) => w.date.split("T")[0];

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Other";
}

function toSession(date: string, list: Workout[], number: number): Session {
  return {
    date,
    number,
    exercises: [...new Set(list.map((w) => w.exercise))],
    categories: [...new Set(list.map((w) => w.category || "Other"))],
    mainCategory: mostCommon(list.map((w) => w.category || "Other")),
    sets: list.reduce((n, w) => n + w.sets.length, 0),
    volumeKg: list.reduce((v, w) => v + w.sets.reduce((s, set) => s + set.reps * set.weight, 0), 0),
  };
}

/** One logged session's raw records (newest session first). */
export interface SessionGroup {
  date: string;
  /** Workout records in the order they were logged. */
  list: Workout[];
}

/**
 * Workouts → sessions: records on the same day with no 3-hour gap between
 * logs. Newest first. Shared by Home (counts, recent) and History (cards).
 */
export function groupSessions(workouts: Workout[]): SessionGroup[] {
  const byDate = new Map<string, Workout[]>();
  for (const w of workouts) byDate.set(dayKey(w), [...(byDate.get(dayKey(w)) ?? []), w]);
  const groups: SessionGroup[] = [];
  for (const [date, list] of byDate) {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let current: Workout[] = [];
    for (const w of sorted) {
      const prev = current[current.length - 1];
      if (prev && Date.parse(w.createdAt) - Date.parse(prev.createdAt) >= SESSION_GAP_MS) {
        groups.push({ date, list: current });
        current = [];
      }
      current.push(w);
    }
    if (current.length) groups.push({ date, list: current });
  }
  return groups.sort((a, b) => b.date.localeCompare(a.date) || b.list[0].createdAt.localeCompare(a.list[0].createdAt));
}

export function summarizeWorkouts(workouts: Workout[], weeklyGoal: number | null, todayKey: string) {
  // Sessions
  const byDate = new Map<string, Workout[]>();
  for (const w of workouts) byDate.set(dayKey(w), [...(byDate.get(dayKey(w)) ?? []), w]);
  const groups = groupSessions(workouts);
  const sessions = groups.map((g, i) => toSession(g.date, g.list, groups.length - i));

  // Today, combined (for plan matching), numbered as today's latest session.
  const todayList = byDate.get(todayKey) ?? [];
  const todaySession = todayList.length
    ? toSession(todayKey, todayList, sessions.find((s) => s.date === todayKey)?.number ?? sessions.length)
    : null;

  // This calendar week (Mon–Sun), counted in training days.
  const trainedDates = new Set(byDate.keys());
  const weekStart = weekKeyOf(todayKey);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const trained = dates.map((d) => trainedDates.has(d));
  const daysTrained = trained.filter(Boolean).length;
  const goal = weeklyGoal && weeklyGoal > 0 ? weeklyGoal : null;
  const week: WeekSummary = {
    dates,
    trained,
    daysTrained,
    goal,
    percent: goal ? Math.min(100, Math.round((daysTrained / goal) * 100)) : null,
    met: !!goal && daysTrained >= goal,
    remaining: goal ? Math.max(0, goal - daysTrained) : 0,
  };

  // Streak in weeks, using the current goal (the backend keeps no goal history).
  const streak: StreakSummary = { current: 0, best: 0 };
  if (goal) {
    const daysPerWeek = new Map<string, number>();
    for (const d of trainedDates) daysPerWeek.set(weekKeyOf(d), (daysPerWeek.get(weekKeyOf(d)) ?? 0) + 1);
    const met = (k: string) => (daysPerWeek.get(k) ?? 0) >= goal;

    let k = met(weekStart) ? weekStart : addDays(weekStart, -7);
    while (met(k)) {
      streak.current++;
      k = addDays(k, -7);
    }

    const weeks = [...daysPerWeek.keys()].sort();
    if (weeks.length) {
      let run = 0;
      for (let w = weeks[0]; w <= weekStart; w = addDays(w, 7)) {
        if (met(w)) {
          run++;
          streak.best = Math.max(streak.best, run);
        } else if (w !== weekStart) {
          run = 0; // an unfinished current week doesn't break the record
        }
      }
    }
  }

  // Suggested next: oldest last-trained group; never trained = oldest; skip today's.
  let suggestion: { label: string; category: ExerciseCategory; daysAgo: number | null } | null = null;
  if (sessions.length) {
    const last: Partial<Record<string, string>> = {};
    for (const w of workouts) if (!last[w.category] || dayKey(w) > last[w.category]!) last[w.category] = dayKey(w);
    let bestScore = -1;
    for (const g of SUGGEST_GROUPS) {
      const d = last[g.category];
      if (d === todayKey) continue;
      const daysAgo = d ? daysBetween(d, todayKey) : null;
      const score = daysAgo ?? Number.POSITIVE_INFINITY;
      if (score > bestScore) {
        bestScore = score;
        suggestion = { ...g, daysAgo };
      }
    }
  }

  // Volume: compare the same span of days, so a Monday never looks like a 90% drop.
  const span = daysBetween(weekStart, todayKey);
  const lastWeekStart = addDays(weekStart, -7);
  const lastWeekEnd = addDays(lastWeekStart, span);
  const volumeOf = (w: Workout) => w.sets.reduce((sum, set) => sum + set.reps * set.weight, 0);
  let thisWeekKg = 0;
  let lastWeekSameSpanKg = 0;
  for (const w of workouts) {
    const d = dayKey(w);
    if (d >= weekStart && d <= todayKey) thisWeekKg += volumeOf(w);
    else if (d >= lastWeekStart && d <= lastWeekEnd) lastWeekSameSpanKg += volumeOf(w);
  }
  const volume: WeekVolume = {
    thisWeekKg,
    lastWeekSameSpanKg,
    changePct: lastWeekSameSpanKg > 0 ? Math.round(((thisWeekKg - lastWeekSameSpanKg) / lastWeekSameSpanKg) * 100) : null,
  };

  return { sessions, todaySession, week, streak, suggestion, volume, recent: sessions.slice(0, MAX_RECENT) };
}

export type WorkoutSummary = ReturnType<typeof summarizeWorkouts>;

/** Home's view of the shared workouts query. */
export function useWorkoutSummary(weeklyGoal: number | null) {
  const query = useAllWorkouts();
  const todayKey = formatDate(new Date());
  const summary = useMemo(() => summarizeWorkouts(query.data ?? [], weeklyGoal, todayKey), [query.data, weeklyGoal, todayKey]);
  return { query, todayKey, ...summary };
}
