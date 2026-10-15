import type { Workout } from "../services/api";
import { displayWeight, weightLabel, type WeightUnit } from "./unitConversion";

/*
 * Per-exercise history derived from the cached workout list. The backend
 * stores no PRs, completion flags or "previous performance", so all of it is
 * computed here, client-side, from the user's own workout records (kg).
 */

export interface LoggedSet {
  /** kg */
  weight: number;
  reps: number;
}

export interface ExerciseSession {
  date: string;
  createdAt: string;
  sets: LoggedSet[];
}

export interface ExerciseHistory {
  name: string;
  category: string;
  /** Oldest first. Records of the same exercise on the same date are merged. */
  sessions: ExerciseSession[];
}

/** Weights closer than this are treated as equal (lbs ↔ kg rounding). */
const EPSILON_KG = 0.05;
const PR_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export const exerciseKey = (name: string) => name.trim().toLowerCase();
const dayKey = (w: Workout) => w.date.split("T")[0];

export function buildExerciseIndex(workouts: Workout[]): Map<string, ExerciseHistory> {
  const index = new Map<string, ExerciseHistory>();
  const sorted = [...workouts].sort((a, b) => dayKey(a).localeCompare(dayKey(b)) || a.createdAt.localeCompare(b.createdAt));
  for (const w of sorted) {
    const key = exerciseKey(w.exercise);
    let entry = index.get(key);
    if (!entry) {
      entry = { name: w.exercise, category: w.category, sessions: [] };
      index.set(key, entry);
    }
    entry.category = w.category || entry.category; // latest wins
    const sets = [...w.sets].sort((a, b) => a.setNumber - b.setNumber).map((s) => ({ weight: s.weight, reps: s.reps }));
    const last = entry.sessions[entry.sessions.length - 1];
    if (last && last.date === dayKey(w)) last.sets.push(...sets);
    else entry.sessions.push({ date: dayKey(w), createdAt: w.createdAt, sets });
  }
  return index;
}

/** Heaviest weight; ties go to more reps. */
export function heaviestSet(sets: LoggedSet[]): LoggedSet | null {
  let best: LoggedSet | null = null;
  for (const s of sets) {
    if (!best || s.weight > best.weight + EPSILON_KG || (Math.abs(s.weight - best.weight) <= EPSILON_KG && s.reps > best.reps)) best = s;
  }
  return best;
}

export const lastSession = (h: ExerciseHistory | undefined) => h?.sessions[h.sessions.length - 1] ?? null;

/** "Last: 80 kg × 8": the heaviest set of the most recent session. */
export function lastBestSet(h: ExerciseHistory | undefined): LoggedSet | null {
  const s = lastSession(h);
  return s ? heaviestSet(s.sets) : null;
}

/** The same set (by position) from the most recent session. */
export function previousSetAt(h: ExerciseHistory | undefined, index: number): LoggedSet | null {
  return lastSession(h)?.sets[index] ?? null;
}

/** Last N distinct exercises, most recent first. */
export function recentExercises(index: Map<string, ExerciseHistory>, limit = 5): ExerciseHistory[] {
  return [...index.values()]
    .filter((h) => h.sessions.length > 0)
    .sort((a, b) => {
      const la = lastSession(a)!;
      const lb = lastSession(b)!;
      return lb.date.localeCompare(la.date) || lb.createdAt.localeCompare(la.createdAt);
    })
    .slice(0, limit);
}

/**
 * Estimated one-rep max (Epley): how strong a set is, whatever the reps, so
 * 60 × 12 can be compared with 60 × 8 or 70 × 5. An estimate, not a test.
 */
export const estimate1RM = (s: LoggedSet) => (s.reps <= 1 ? s.weight : s.weight * (1 + s.reps / 30));

/**
 * PR rule (shared by logging, History, Home and Analytics). A set is a PR when
 * it either
 *  - is heavier than the heaviest earlier weight lifted for at least as many
 *    reps (a weight PR), or
 *  - beats every earlier set's estimated 1RM (more reps at the same weight,
 *    or heavier and more reps).
 * Needs an earlier set to compare against, so a first-ever session never
 * produces a PR. Bodyweight (0 kg) sets are never PRs. Light high-rep sets
 * (warm-ups) don't qualify: their estimate stays below the working sets'.
 */
export function prBaseline(prior: LoggedSet[], reps: number): LoggedSet | null {
  return heaviestSet(prior.filter((s) => s.reps >= reps));
}

/** weight: heavier for the reps · reps: more reps at the same weight · strength: best estimated 1RM. */
export type PRKind = "weight" | "reps" | "strength";

export function checkPR(prior: LoggedSet[], set: LoggedSet): { isPR: boolean; previous: LoggedSet | null; kind: PRKind | null } {
  if (set.weight <= 0 || set.reps <= 0 || prior.length === 0) return { isPR: false, previous: null, kind: null };
  const baseline = prBaseline(prior, set.reps);
  if (baseline && set.weight > baseline.weight + EPSILON_KG) return { isPR: true, previous: baseline, kind: "weight" };

  let strongest: LoggedSet | null = null;
  for (const s of prior) if (!strongest || estimate1RM(s) > estimate1RM(strongest)) strongest = s;
  if (!strongest || estimate1RM(set) <= estimate1RM(strongest) + EPSILON_KG) return { isPR: false, previous: baseline, kind: null };

  // Describe it against the most comparable earlier set.
  const sameWeight = prior.filter((s) => Math.abs(s.weight - set.weight) <= EPSILON_KG);
  const mostReps = sameWeight.reduce<LoggedSet | null>((b, s) => (!b || s.reps > b.reps ? s : b), null);
  if (mostReps && set.reps > mostReps.reps) return { isPR: true, previous: mostReps, kind: "reps" };
  return { isPR: true, previous: strongest, kind: set.weight > strongest.weight + EPSILON_KG ? "weight" : "strength" };
}

/** "+5 kg", "+4 reps" or "Stronger set": what the PR gained. */
export function prGain(set: LoggedSet, previous: LoggedSet, kind: PRKind, unit: WeightUnit): string {
  if (kind === "reps") return `+${set.reps - previous.reps} ${set.reps - previous.reps === 1 ? "rep" : "reps"}`;
  if (kind === "weight") return formatGain(set.weight - previous.weight, unit);
  return "Stronger set";
}

/** "Previous best: 80 kg × 8 (+5 kg)", "(+4 reps)", or "Strongest set yet · was 100 kg × 5". */
export function prDetail(set: LoggedSet, previous: LoggedSet, kind: PRKind, unit: WeightUnit): string {
  const was = formatSet(previous, unit);
  if (kind === "strength") return `Strongest set yet · was ${was}`;
  return `Previous best: ${was} (${prGain(set, previous, kind, unit)})`;
}

export const allSets = (h: ExerciseHistory | undefined) => h?.sessions.flatMap((s) => s.sets) ?? [];

/** True if any set logged in the last 30 days was a PR at the time. */
export function hadRecentPR(h: ExerciseHistory | undefined, todayKey: string, days = PR_WINDOW_DAYS): boolean {
  if (!h || h.sessions.length < 2) return false;
  const cutoff = Date.parse(`${todayKey}T00:00:00`) - days * DAY_MS;
  const prior: LoggedSet[] = [...h.sessions[0].sets];
  for (const session of h.sessions.slice(1)) {
    const inWindow = Date.parse(`${session.date}T00:00:00`) >= cutoff;
    for (const set of session.sets) {
      if (inWindow && checkPR(prior, set).isPR) return true;
    }
    prior.push(...session.sets);
  }
  return false;
}

const trim = (n: number) => String(Math.round(n * 10) / 10);

/** "80 kg × 8", "176.4 lbs × 8", or "Bodyweight × 12". */
export function formatSet(set: LoggedSet | null, unit: WeightUnit): string | null {
  if (!set) return null;
  if (set.weight <= 0) return `Bodyweight × ${set.reps}`;
  return `${trim(displayWeight(set.weight, unit))} ${weightLabel(unit)} × ${set.reps}`;
}

/** "+2.5 kg" in the display unit. */
export function formatGain(kg: number, unit: WeightUnit): string {
  return `+${trim(displayWeight(kg, unit))} ${weightLabel(unit)}`;
}

export const formatWeightValue = (value: number) => trim(value);

/** kg → the display unit, to one decimal. */
export const displayWeightRounded = (kg: number, unit: WeightUnit) => Math.round(displayWeight(kg, unit) * 10) / 10;

// Precomputed per-exercise summaries (one pass per workouts change)

export interface ExerciseSummary {
  /** Most recent session's date, set count and heaviest set. */
  lastDate: string;
  lastSetCount: number;
  lastBest: LoggedSet | null;
  /** Date of the most recent set that was a PR when logged (null if never). */
  prDate: string | null;
}

/** Walks each exercise's history once; rows then read their summary in O(1). */
export function buildExerciseSummaries(index: Map<string, ExerciseHistory>): Map<string, ExerciseSummary> {
  const out = new Map<string, ExerciseSummary>();
  for (const [key, h] of index) {
    const last = h.sessions[h.sessions.length - 1];
    if (!last) continue;
    let prDate: string | null = null;
    // Running best weight per rep count lets each PR check be O(distinct reps).
    const bestAtReps = new Map<number, number>();
    const priorBest = (reps: number) => {
      let best = -1;
      for (const [r, wt] of bestAtReps) if (r >= reps && wt > best) best = wt;
      return best;
    };
    // Same rule as checkPR: a weight PR, or a new best estimated 1RM.
    let best1RM = -1;
    h.sessions.forEach((session, i) => {
      for (const set of session.sets) {
        if (i > 0 && set.weight > 0 && set.reps > 0) {
          const best = priorBest(set.reps);
          if ((best >= 0 && set.weight > best + EPSILON_KG) || (best1RM >= 0 && estimate1RM(set) > best1RM + EPSILON_KG)) prDate = session.date;
        }
      }
      for (const set of session.sets) {
        bestAtReps.set(set.reps, Math.max(bestAtReps.get(set.reps) ?? 0, set.weight));
        best1RM = Math.max(best1RM, estimate1RM(set));
      }
    });
    out.set(key, { lastDate: last.date, lastSetCount: last.sets.length, lastBest: heaviestSet(last.sets), prDate });
  }
  return out;
}

/** True if the summary's last PR falls within `days` of today. */
export function prWithin(summary: ExerciseSummary | undefined, todayKey: string, days = PR_WINDOW_DAYS): boolean {
  if (!summary?.prDate) return false;
  return Date.parse(`${summary.prDate}T00:00:00`) >= Date.parse(`${todayKey}T00:00:00`) - days * DAY_MS;
}

/** "Last time: 3 sets · best 20 kg × 15 · 10 Oct", or the first-time text. */
export function lastTimeText(summary: ExerciseSummary | undefined, unit: WeightUnit): string {
  if (!summary) return "First time logging this";
  const date = new Date(`${summary.lastDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const best = formatSet(summary.lastBest, unit);
  return [`Last time: ${summary.lastSetCount} ${summary.lastSetCount === 1 ? "set" : "sets"}`, best ? `best ${best}` : null, date]
    .filter(Boolean)
    .join(" · ");
}

/* One shared index per workouts array, so every screen reuses the same build. */
const indexCache = new WeakMap<object, { index: Map<string, ExerciseHistory>; summaries: Map<string, ExerciseSummary>; events?: PREvent[] }>();

export function exerciseIndexFor(workouts: Workout[]) {
  let hit = indexCache.get(workouts);
  if (!hit) {
    const index = buildExerciseIndex(workouts);
    hit = { index, summaries: buildExerciseSummaries(index) };
    indexCache.set(workouts, hit);
  }
  return hit;
}

/* History as it stood on a past date (logging a backdated workout). Cached per index. */
const asOfCache = new WeakMap<object, Map<string, { index: Map<string, ExerciseHistory>; summaries: Map<string, ExerciseSummary> }>>();

/**
 * The index and summaries limited to sessions on or before `dateKey`, so a
 * workout logged for the 12th compares with what came before the 12th, not
 * with the 13th. Null (today) or nothing later returns the full index as is.
 */
export function indexAsOf(
  index: Map<string, ExerciseHistory>,
  summaries: Map<string, ExerciseSummary>,
  dateKey: string | null,
): { index: Map<string, ExerciseHistory>; summaries: Map<string, ExerciseSummary> } {
  if (!dateKey) return { index, summaries };
  let later = false;
  for (const h of index.values()) if (h.sessions[h.sessions.length - 1]?.date > dateKey) later = true;
  if (!later) return { index, summaries };

  let byDate = asOfCache.get(index);
  if (!byDate) asOfCache.set(index, (byDate = new Map()));
  const hit = byDate.get(dateKey);
  if (hit) return hit;

  const limited = new Map<string, ExerciseHistory>();
  for (const [key, h] of index) {
    const sessions = h.sessions.filter((s) => s.date <= dateKey);
    if (sessions.length) limited.set(key, { ...h, sessions });
  }
  const out = { index: limited, summaries: buildExerciseSummaries(limited) };
  byDate.set(dateKey, out);
  return out;
}

/** Every PR event for these workouts (built once per workouts array). */
export function prEventsFor(workouts: Workout[]): PREvent[] {
  const hit = exerciseIndexFor(workouts);
  if (!hit.events) hit.events = prEvents(hit.index);
  return hit.events;
}

// PR events (one per exercise per session that set a PR)

export interface PREvent {
  exercise: string;
  category: string;
  /** The session's strongest PR set (by estimated 1RM), kg. */
  set: LoggedSet;
  /** What it beat. */
  previous: LoggedSet;
  kind: PRKind;
  date: string;
}

/** Oldest first. Sets in a session are compared with earlier sessions only. */
export function prEvents(index: Map<string, ExerciseHistory>): PREvent[] {
  const out: PREvent[] = [];
  for (const h of index.values()) {
    if (h.sessions.length < 2) continue;
    const prior: LoggedSet[] = [...h.sessions[0].sets];
    for (const session of h.sessions.slice(1)) {
      let best: PREvent | null = null;
      for (const set of session.sets) {
        const { isPR, previous, kind } = checkPR(prior, set);
        if (isPR && previous && kind && (!best || estimate1RM(set) > estimate1RM(best.set))) {
          best = { exercise: h.name, category: h.category, set, previous, kind, date: session.date };
        }
      }
      if (best) out.push(best);
      prior.push(...session.sets);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Recent personal records (Home highlight)

export interface RecentPR {
  exercise: string;
  /** The heaviest PR set in the window, kg. */
  set: LoggedSet;
  previous: LoggedSet;
  kind: PRKind;
  date: string;
}

/**
 * PRs set in the last `days` days, one per exercise (its heaviest), newest
 * first. Same rule as everywhere else (checkPR); a first-ever session is never a PR.
 */
export function recentPRs(index: Map<string, ExerciseHistory>, todayKey: string, days = 7): RecentPR[] {
  const cutoff = Date.parse(`${todayKey}T00:00:00`) - (days - 1) * DAY_MS;
  const byExercise = new Map<string, RecentPR>();
  for (const e of prEvents(index)) {
    if (Date.parse(`${e.date}T00:00:00`) < cutoff) continue;
    const cur = byExercise.get(e.exercise);
    if (!cur || e.set.weight > cur.set.weight + EPSILON_KG) byExercise.set(e.exercise, { exercise: e.exercise, set: e.set, previous: e.previous, kind: e.kind, date: e.date });
  }
  return [...byExercise.values()].sort((a, b) => b.date.localeCompare(a.date) || b.set.weight - a.set.weight);
}

/**
 * "exercise|date" keys for every exercise session that set a PR at the time
 * (same rule as everywhere: beats the heaviest earlier weight at the same or
 * more reps; a first-ever session never counts). Used for History's PR badges.
 */
export function prExerciseDays(index: Map<string, ExerciseHistory>): Set<string> {
  const out = new Set<string>();
  for (const [key, h] of index) {
    if (h.sessions.length < 2) continue;
    const prior: LoggedSet[] = [...h.sessions[0].sets];
    for (const session of h.sessions.slice(1)) {
      if (session.sets.some((set) => checkPR(prior, set).isPR)) out.add(`${key}|${session.date}`);
      prior.push(...session.sets);
    }
  }
  return out;
}
