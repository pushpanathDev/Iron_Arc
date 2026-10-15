import { groupSessions } from "../hooks/useWorkoutSummary";
import type { Workout } from "../services/api";
import { checkPR, estimate1RM, heaviestSet, prGain, type ExerciseHistory, type LoggedSet, type PREvent } from "./exerciseHistory";
import type { WeightUnit } from "./unitConversion";
import { addDays, formatDate, getWeekStart, parseLocalDate } from "./weekUtils";

/*
 * Everything the Analytics tab shows, derived from the shared workouts list
 * (kg). Pure, so it is unit-tested; the screen only formats. No durations:
 * the backend stores none, so activity is measured in sets.
 */

export type AnalyticsPeriod = "week" | "month" | "quarter" | "all";

export const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "3 Months" },
  { key: "all", label: "All" },
];

/** One bar of the activity chart. */
export interface ActivityBucket {
  key: string;
  /** Axis label; "" when skipped to avoid crowding. */
  label: string;
  sets: number;
  volumeKg: number;
  /** Contains today. */
  current: boolean;
  /** Starts after today (drawn empty, never as a rest day). */
  future: boolean;
  /** Day buckets only: the date, so a tap can open History for it. */
  day: string | null;
  /** First and last day covered (clipped to the period). */
  from: string;
  to: string;
  /** Workouts (sessions) in this bucket. */
  sessions: number;
}

export interface BalanceRow {
  category: string;
  sets: number;
  /** Rounded % of the period's sets. */
  share: number;
}

export interface PeriodComparison {
  /** "last week", "last month", "the 3 months before". */
  against: string;
  /** % change in volume over the same span, or null with nothing to compare. */
  volumePct: number | null;
}

export interface PeriodStats {
  start: string;
  /** Last day counted (today for open periods). */
  end: string;
  sessions: number;
  sets: number;
  volumeKg: number;
  trainingDays: number;
  buckets: ActivityBucket[];
  /** What a bar measures: "day", "week" or "month". */
  bucketUnit: "day" | "week" | "month";
  /** "All" with over 12 months of history: the chart shows the last 12 only. */
  chartTruncated: boolean;
  compare: PeriodComparison | null;
  balance: BalanceRow[];
  /** Least-trained main groups, once there's enough to judge (else null). */
  leastTrained: { categories: string[]; untrained: boolean } | null;
}

/** Main groups always listed in Muscle balance (stored names; "Abs" shows as Core). */
export const MAIN_GROUPS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Abs"] as const;
/** Need this much in the period before calling a group "least trained". */
const BALANCE_MIN_SESSIONS = 2;
const BALANCE_MIN_SETS = 10;
const CHART_MAX_MONTHS = 12;
const ALL_MIN_MONTHS = 6;
/** Above this many bars, labels thin out. */
const MAX_LABELLED_BARS = 7;

const dayKey = (w: Workout) => w.date.split("T")[0];
const volumeOf = (w: Workout) => w.sets.reduce((v, s) => v + s.reps * s.weight, 0);

function addMonths(key: string, n: number) {
  const d = parseLocalDate(key);
  return formatDate(new Date(d.getFullYear(), d.getMonth() + n, 1));
}
const monthStart = (key: string) => `${key.slice(0, 7)}-01`;
const monthEnd = (key: string) => addDays(addMonths(key, 1), -1);
const weekStartOf = (key: string) => formatDate(getWeekStart(parseLocalDate(key)));
const minKey = (a: string, b: string) => (a < b ? a : b);
const maxKey = (a: string, b: string) => (a > b ? a : b);

const weekday = (key: string) => parseLocalDate(key).toLocaleDateString(undefined, { weekday: "short" });
const shortMonth = (key: string) => parseLocalDate(key).toLocaleDateString(undefined, { month: "short" });

/** [start, end] of the period, inclusive; `end` may be in the future (rest of this week/month). */
export function periodRange(period: AnalyticsPeriod, todayKey: string, firstKey: string | null): { start: string; end: string } {
  switch (period) {
    case "week": {
      const start = weekStartOf(todayKey);
      return { start, end: addDays(start, 6) };
    }
    case "month":
      return { start: monthStart(todayKey), end: monthEnd(todayKey) };
    case "quarter": {
      const thisWeek = weekStartOf(todayKey);
      return { start: addDays(thisWeek, -12 * 7), end: addDays(thisWeek, 6) };
    }
    case "all":
      return { start: firstKey && firstKey < todayKey ? firstKey : todayKey, end: todayKey };
  }
}

/** The same span just before, for "vs last week" (Mon..same weekday, 1st..same date, …). */
function previousSpan(period: AnalyticsPeriod, start: string, todayKey: string): { start: string; end: string; against: string } | null {
  switch (period) {
    case "week":
      return { start: addDays(start, -7), end: addDays(todayKey, -7), against: "last week" };
    case "month": {
      const prevStart = addMonths(start, -1);
      const day = Number(todayKey.slice(8, 10));
      const prevEnd = minKey(`${prevStart.slice(0, 8)}${String(day).padStart(2, "0")}`, monthEnd(prevStart));
      return { start: prevStart, end: prevEnd, against: "last month" };
    }
    case "quarter":
      return { start: addDays(start, -13 * 7), end: addDays(todayKey, -13 * 7), against: "the 3 months before" };
    case "all":
      return null;
  }
}

function buildBuckets(period: AnalyticsPeriod, start: string, end: string, todayKey: string) {
  const spans: { key: string; from: string; to: string; label: string; day: string | null }[] = [];
  let unit: PeriodStats["bucketUnit"] = "week";
  let truncated = false;

  if (period === "week") {
    unit = "day";
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      spans.push({ key: d, from: d, to: d, label: weekday(d), day: d });
    }
  } else if (period === "month" || period === "quarter") {
    for (let w = weekStartOf(start); w <= end; w = addDays(w, 7)) {
      const from = maxKey(w, start);
      const to = minKey(addDays(w, 6), end);
      // Month: "12–18" reads as a week; 3 Months: the month name once.
      spans.push({ key: from, from, to, label: period === "month" ? `${Number(from.slice(8))}–${Number(to.slice(8))}` : shortMonth(from), day: null });
    }
    // 3 Months: name each month once, at its first week.
    if (period === "quarter") spans.forEach((s, i) => i > 0 && s.label === spans[i - 1].label && (s.label = ""));
  } else {
    unit = "month";
    // At least ALL_MIN_MONTHS bars, so a new user's first month isn't one lone column.
    let from = minKey(monthStart(start), addMonths(monthStart(todayKey), -(ALL_MIN_MONTHS - 1)));
    const firstShown = addMonths(monthStart(todayKey), -(CHART_MAX_MONTHS - 1));
    if (from < firstShown) {
      from = firstShown;
      truncated = true;
    }
    for (let m = from; m <= end; m = addMonths(m, 1)) spans.push({ key: m, from: m, to: monthEnd(m), label: shortMonth(m), day: null });
    if (spans.length > MAX_LABELLED_BARS) spans.forEach((s, i) => (spans.length - 1 - i) % 2 === 1 && (s.label = ""));
  }

  const buckets: ActivityBucket[] = spans.map((s) => ({
    key: s.key,
    label: s.label,
    sets: 0,
    volumeKg: 0,
    current: s.from <= todayKey && todayKey <= s.to,
    future: s.from > todayKey,
    day: s.day,
    from: s.from,
    to: s.to,
    sessions: 0,
  }));
  const find = (d: string) => spans.findIndex((s) => s.from <= d && d <= s.to);
  return { buckets, find, unit, truncated };
}

export function analyzePeriod(workouts: Workout[], period: AnalyticsPeriod, todayKey: string): PeriodStats {
  const firstKey = workouts.reduce<string | null>((min, w) => (!min || dayKey(w) < min ? dayKey(w) : min), null);
  const { start, end: rangeEnd } = periodRange(period, todayKey, firstKey);
  const end = minKey(rangeEnd, todayKey);
  const inRange = (d: string) => d >= start && d <= end;

  const list = workouts.filter((w) => inRange(dayKey(w)));
  const { buckets, find, unit, truncated } = buildBuckets(period, start, rangeEnd, todayKey);

  let sets = 0;
  let volumeKg = 0;
  const perCategory = new Map<string, number>();
  for (const w of list) {
    const v = volumeOf(w);
    sets += w.sets.length;
    volumeKg += v;
    const cat = w.category || "Other";
    perCategory.set(cat, (perCategory.get(cat) ?? 0) + w.sets.length);
    const i = find(dayKey(w));
    if (i >= 0) {
      buckets[i].sets += w.sets.length;
      buckets[i].volumeKg += v;
    }
  }
  const groups = groupSessions(list);
  const sessions = groups.length;
  for (const g of groups) {
    const i = find(g.date);
    if (i >= 0) buckets[i].sessions += 1;
  }
  const trainingDays = new Set(list.map(dayKey)).size;

  // Same span before (Monday vs Monday), so early in a week it never looks like a crash.
  const prev = previousSpan(period, start, todayKey);
  let compare: PeriodComparison | null = null;
  if (prev) {
    const prevKg = workouts.filter((w) => dayKey(w) >= prev.start && dayKey(w) <= prev.end).reduce((v, w) => v + volumeOf(w), 0);
    compare = { against: prev.against, volumePct: prevKg > 0 ? Math.round(((volumeKg - prevKg) / prevKg) * 100) : null };
  }

  // Muscle balance: the six main groups always (0% shows a gap), others only when trained.
  const order = (c: string) => {
    const i = (MAIN_GROUPS as readonly string[]).indexOf(c);
    return i < 0 ? MAIN_GROUPS.length : i;
  };
  const categories = new Set<string>([...MAIN_GROUPS, ...perCategory.keys()]);
  const balance: BalanceRow[] = [...categories]
    .map((category) => {
      const n = perCategory.get(category) ?? 0;
      return { category, sets: n, share: sets > 0 ? Math.round((n / sets) * 100) : 0 };
    })
    .filter((r) => r.sets > 0 || order(r.category) < MAIN_GROUPS.length)
    .sort((a, b) => b.sets - a.sets || order(a.category) - order(b.category));

  let leastTrained: PeriodStats["leastTrained"] = null;
  if (sessions >= BALANCE_MIN_SESSIONS && sets >= BALANCE_MIN_SETS) {
    const main = MAIN_GROUPS.map((c) => ({ c, n: perCategory.get(c) ?? 0 }));
    const min = Math.min(...main.map((m) => m.n));
    leastTrained = { categories: main.filter((m) => m.n === min).map((m) => m.c), untrained: min === 0 };
  }

  return { start, end, sessions, sets, volumeKg, trainingDays, buckets, bucketUnit: unit, chartTruncated: truncated, compare, balance, leastTrained };
}

// Best lifts (Personal records card)

export interface BestLift {
  exercise: string;
  /** Heaviest set ever (ties: more reps), kg. */
  set: LoggedSet;
  /** First date that set was lifted. */
  date: string;
  /** A PR (same rule as everywhere) was set for this exercise within the period. */
  prInPeriod: boolean;
}

/**
 * Heaviest lift per exercise, newest first. Bodyweight-only exercises are
 * left out (no weight to rank). The star (prInPeriod) uses the shared PR rule:
 * beats the heaviest earlier weight at the same or more reps; a first-ever
 * session is never a PR.
 */
export function bestLifts(index: Map<string, ExerciseHistory>, start: string, end: string): BestLift[] {
  const out: BestLift[] = [];
  for (const h of index.values()) {
    let best: LoggedSet | null = null;
    let date = "";
    let prInPeriod = false;
    const prior: LoggedSet[] = [];
    h.sessions.forEach((session, i) => {
      const top = heaviestSet(session.sets.filter((s) => s.weight > 0));
      // heaviestSet keeps the first on a tie, so `date` stays the first time it was lifted.
      const winner = top ? heaviestSet(best ? [best, top] : [top]) : best;
      if (winner !== best) {
        best = winner;
        date = session.date;
      }
      if (i > 0 && !prInPeriod && session.date >= start && session.date <= end) {
        prInPeriod = session.sets.some((s) => checkPR(prior, s).isPR);
      }
      prior.push(...session.sets);
    });
    if (best) out.push({ exercise: h.name, set: best, date, prInPeriod });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.set.weight - a.set.weight);
}

// Weekly sets per muscle group

/** A commonly used guide: about 10–20 hard sets per muscle group a week. */
export const WEEKLY_SETS_RANGE = { low: 10, high: 20 } as const;

export interface MuscleWeek {
  category: string;
  sets: number;
  /** Average sets a week over the period's elapsed weeks (1 decimal). */
  perWeek: number;
  status: "under" | "inRange" | "over";
  /** Days since this group was last trained (any time), null if never. */
  daysSince: number | null;
}

const daysBetween = (a: string, b: string) => Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86_400_000);

/** The six main groups, busiest first; per-week averages use the weeks elapsed so far (at least one). */
export function muscleWeeks(workouts: Workout[], stats: PeriodStats, todayKey: string): MuscleWeek[] {
  const weeks = Math.max(1, (daysBetween(stats.start, stats.end) + 1) / 7);
  const last = new Map<string, string>();
  for (const w of workouts) {
    const d = dayKey(w);
    if (!last.get(w.category) || d > last.get(w.category)!) last.set(w.category, d);
  }
  return MAIN_GROUPS.map((category) => {
    const sets = stats.balance.find((r) => r.category === category)?.sets ?? 0;
    const perWeek = Math.round((sets / weeks) * 10) / 10;
    const seen = last.get(category);
    return {
      category,
      sets,
      perWeek,
      status: perWeek < WEEKLY_SETS_RANGE.low ? "under" : perWeek > WEEKLY_SETS_RANGE.high ? "over" : "inRange",
      daysSince: seen ? daysBetween(seen, todayKey) : null,
    } satisfies MuscleWeek;
  }).sort((a, b) => b.perWeek - a.perWeek || MAIN_GROUPS.indexOf(a.category as never) - MAIN_GROUPS.indexOf(b.category as never));
}

// Records in a period, and records within reach

/** PR events inside [start, end], newest first. */
export function prsInRange(events: PREvent[], start: string, end: string): PREvent[] {
  return events.filter((e) => e.date >= start && e.date <= end).sort((a, b) => b.date.localeCompare(a.date) || estimate1RM(b.set) - estimate1RM(a.set));
}

export interface ReachTarget {
  exercise: string;
  /** Last session's top set (kg). */
  last: LoggedSet;
  lastDate: string;
  /** The smallest next set that would be a PR (kg). */
  target: LoggedSet;
  kind: "reps" | "weight";
}

const REACH_RECENT_DAYS = 21;
const REACH_MAX_EXTRA_REPS = 2;
const REACH_LIMIT = 3;

/**
 * For lifts trained in the last three weeks: the smallest step from the last
 * session's top set that the PR rule would count (one or two more reps, else
 * one weight step). Checked with checkPR against the full history, so the
 * promise is true.
 */
export function withinReach(index: Map<string, ExerciseHistory>, todayKey: string, weightStepKg: number, recentDays = REACH_RECENT_DAYS): ReachTarget[] {
  const out: ReachTarget[] = [];
  for (const h of index.values()) {
    const session = h.sessions[h.sessions.length - 1];
    if (!session || h.sessions.length < 2 || daysBetween(session.date, todayKey) > recentDays) continue;
    const top = heaviestSet(session.sets.filter((s) => s.weight > 0 && s.reps > 0));
    if (!top) continue;
    const all = h.sessions.flatMap((s) => s.sets);
    let target: ReachTarget | null = null;
    for (let extra = 1; extra <= REACH_MAX_EXTRA_REPS && !target; extra++) {
      const t = { weight: top.weight, reps: top.reps + extra };
      if (checkPR(all, t).isPR) target = { exercise: h.name, last: top, lastDate: session.date, target: t, kind: "reps" };
    }
    if (!target) {
      const t = { weight: Math.round((top.weight + weightStepKg) * 100) / 100, reps: top.reps };
      if (checkPR(all, t).isPR) target = { exercise: h.name, last: top, lastDate: session.date, target: t, kind: "weight" };
    }
    if (target) out.push(target);
  }
  return out
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || (a.kind === "reps" ? -1 : 1) - (b.kind === "reps" ? -1 : 1))
    .slice(0, REACH_LIMIT);
}

// Headline (one sentence that changes with the data)

export interface Headline {
  icon: "star" | "trending-up" | "emoji-events" | "warning-amber" | "insights";
  text: string;
  /** Optional second line ("Deadlift +3 reps · Bench Press +2.5 kg"). */
  detail?: string;
  tone: "record" | "good" | "warning" | "neutral";
}

/** Sets per calendar week (Monday keys), for "biggest week yet". */
function setsPerWeek(workouts: Workout[]) {
  const m = new Map<string, number>();
  for (const w of workouts) m.set(weekStartOf(dayKey(w)), (m.get(weekStartOf(dayKey(w))) ?? 0) + w.sets.length);
  return m;
}

/**
 * Priority: new records → biggest week/month yet → volume up → a group left
 * out → plain count. Every sentence is computed from the user's own data.
 */
export function headlineFor(
  workouts: Workout[],
  period: AnalyticsPeriod,
  stats: PeriodStats,
  prs: PREvent[],
  todayKey: string,
  phrase: string,
  unit: WeightUnit = "kg",
): Headline {
  if (prs.length > 0) {
    const names = [...new Set(prs.map((p) => p.exercise))];
    const lead = names.length === 1 ? names[0] : `${names[0]} and ${names.length - 1} more`;
    const detail = prs.slice(0, 2).map((p) => `${p.exercise} ${prGain(p.set, p.previous, p.kind, unit)}`).join(" · ");
    return { icon: "star", tone: "record", text: `${prs.length} new ${prs.length === 1 ? "record" : "records"} ${phrase}: ${lead}`, detail };
  }
  if (period === "week" && stats.sets > 0) {
    const perWeek = setsPerWeek(workouts);
    const thisWeek = weekStartOf(todayKey);
    const earlier = [...perWeek.entries()].filter(([k]) => k < thisWeek).map(([, n]) => n);
    if (earlier.length >= 2 && stats.sets > Math.max(...earlier)) {
      return { icon: "emoji-events", tone: "record", text: `Your biggest week yet: ${stats.sets} sets`, detail: `Previous best: ${Math.max(...earlier)} sets` };
    }
  }
  if (stats.compare?.volumePct != null && stats.compare.volumePct >= 10) {
    return { icon: "trending-up", tone: "good", text: `Volume up ${stats.compare.volumePct}% on the same days ${stats.compare.against}` };
  }
  if (stats.leastTrained?.untrained) {
    const names = stats.leastTrained.categories.map((c) => (c === "Abs" ? "core" : c.toLowerCase()));
    return { icon: "warning-amber", tone: "warning", text: `Nothing for ${names.join(" or ")} ${phrase}${period === "all" ? "" : " yet"}` };
  }
  return {
    icon: "insights",
    tone: "neutral",
    text: stats.sessions > 0 ? `${stats.sessions} ${stats.sessions === 1 ? "workout" : "workouts"} and ${stats.sets} sets ${phrase}` : `No workouts ${phrase} yet`,
  };
}

/** Exercises per category in [start, end] with their set counts, busiest first. */
export function exercisesByCategory(workouts: Workout[], start: string, end: string): Map<string, { exercise: string; sets: number }[]> {
  const counts = new Map<string, Map<string, number>>();
  for (const w of workouts) {
    const d = dayKey(w);
    if (d < start || d > end) continue;
    const cat = w.category || "Other";
    const m = counts.get(cat) ?? new Map<string, number>();
    m.set(w.exercise, (m.get(w.exercise) ?? 0) + w.sets.length);
    counts.set(cat, m);
  }
  const out = new Map<string, { exercise: string; sets: number }[]>();
  for (const [cat, m] of counts) out.set(cat, [...m.entries()].map(([exercise, sets]) => ({ exercise, sets })).sort((a, b) => b.sets - a.sets || a.exercise.localeCompare(b.exercise)));
  return out;
}
