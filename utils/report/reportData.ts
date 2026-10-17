/*
 * The monthly report: every number the PDF and the spreadsheet show, worked
 * out once from the user's data. Pure, so it's tested without a phone.
 * Weights stay in kg here; the PDF and the sheet convert for display.
 */
import { groupSessions } from "../../hooks/useWorkoutSummary";
import type { Achievement, AchievementTier, BodyWeight, Workout } from "../../services/api";
import { muscleGroupOf, type CustomArms } from "../analytics";
import { addDays, daysBetween, parseLocalDate } from "../dates";
import { prEventsFor } from "../exerciseHistory";

export interface ReportInput {
  workouts: Workout[];
  weights: BodyWeight[];
  achievements: Achievement[];
  /** "YYYY-MM" */
  month: string;
  /** "YYYY-MM-DD" */
  todayKey: string;
  firstName: string;
  weeklyGoal: number | null;
  goalWeightKg: number | null;
  customArms?: CustomArms;
}

export interface ReportWeek {
  label: string;
  start: string;
  end: string;
  workouts: number;
  volumeKg: number;
  /** null when there's no weekly goal. */
  metTarget: boolean | null;
  best: boolean;
}

export interface ReportPR {
  exercise: string;
  date: string;
  weightKg: number;
  reps: number;
  /** The best it beat. */
  previousKg: number;
  previousReps: number;
}

export interface ReportExercise {
  name: string;
  sets: number;
  topWeightKg: number;
  topReps: number;
  volumeKg: number;
}

export interface ReportBadge {
  title: string;
  tier: AchievementTier;
  date: string;
}

export interface ReportNextBadge {
  title: string;
  progress: number;
  target: number;
}

export interface ReportData {
  month: string;
  /** "September 2026" */
  monthName: string;
  /** "1 Sep – 30 Sep 2026" (to today in the current month). */
  rangeLabel: string;
  start: string;
  end: string;
  /** Days of the month counted so far (all of them for a past month). */
  daysSoFar: number;
  isCurrentMonth: boolean;
  headline: string;
  subline: string;

  workouts: number;
  workoutsVsLastMonth: number | null;
  daysTrained: number;
  volumeKg: number;
  bestVolumeMonth: boolean;
  /** Most days in a row trained this month, and whether that run is still going. */
  longestRun: number;
  runOngoing: boolean;

  weeklyGoal: number | null;
  weeks: ReportWeek[];
  weeksMet: number;

  prs: ReportPR[];
  muscles: { group: string; sets: number }[];
  totalSets: number;
  totalReps: number;
  topExercises: ReportExercise[];
  /** The heaviest set of the month. */
  heaviest: { exercise: string; weightKg: number; reps: number } | null;
  volumeVsLastMonthPct: number | null;

  calendar: { date: string; trained: boolean; pr: boolean; future: boolean }[];

  body: { startKg: number; latestKg: number; changeKg: number; checkIns: number; points: { date: string; kg: number }[]; towardGoal: boolean | null } | null;

  badges: ReportBadge[];
  nextBadges: ReportNextBadge[];
  insight: string;

  /** One row per set, oldest first: the spreadsheet's Workouts sheet. */
  setRows: { date: string; category: string; exercise: string; set: number; reps: number; weightKg: number; notes: string; pr: boolean }[];
  /** The month's weigh-ins, oldest first. */
  weightRows: { date: string; kg: number }[];
  /** Every badge: unlocked first (newest first), then the rest by progress. */
  badgeRows: { title: string; tier: AchievementTier; unlockedAt: string | null; progress: number; target: number }[];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));

const dayKey = (iso: string) => iso.split("T")[0];
const volumeOf = (w: Workout) => w.sets.reduce((v, s) => v + s.weight * s.reps, 0);
const inRange = (key: string, start: string, end: string) => key >= start && key <= end;
const shortDay = (key: string) => `${Number(key.slice(8, 10))} ${SHORT_MONTHS[Number(key.slice(5, 7)) - 1]}`;

/** First and last day ("YYYY-MM-DD") of a "YYYY-MM" month. */
export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** "September 2026" */
export const monthName = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** Months with at least one workout, newest first, always starting with the current one. */
export function reportMonths(workouts: Pick<Workout, "date">[], todayKey: string): string[] {
  const months = new Set(workouts.map((w) => dayKey(w.date).slice(0, 7)));
  months.add(todayKey.slice(0, 7));
  return [...months].filter((m) => m <= todayKey.slice(0, 7)).sort().reverse();
}

/** Workouts and days trained in a month, for the month picker's line under the name. */
export function monthAtAGlance(workouts: Workout[], month: string): { workouts: number; days: number } {
  const inMonth = workouts.filter((w) => dayKey(w.date).startsWith(month));
  return { workouts: groupSessions(inMonth).length, days: new Set(inMonth.map((w) => dayKey(w.date))).size };
}

/** The month in 7-day blocks from the 1st; the last block takes the leftover days. */
function monthWeeks(start: string, end: string): { start: string; end: string }[] {
  const weeks = [0, 7, 14, 21].map((offset) => ({ start: addDays(start, offset), end: addDays(start, offset + 6) }));
  weeks[3].end = end;
  return weeks;
}

function longestRunOf(days: Set<string>, start: string, end: string): { length: number; endsOn: string | null } {
  let best = 0;
  let bestEnd: string | null = null;
  let run = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    run = days.has(d) ? run + 1 : 0;
    if (run > 0 && run >= best) {
      best = run;
      bestEnd = d;
    }
  }
  return { length: best, endsOn: bestEnd };
}

function headlineFor(name: string, workouts: number, lastMonth: number, firstMonth: boolean, weeksMet: number, weeksCounted: number, monthLabel: string): { headline: string; subline: string } {
  const who = name ? `${name.toUpperCase()}, ` : "";
  if (workouts === 0) return { headline: "A FRESH PAGE.", subline: `No workouts logged in ${monthLabel}. The next one starts the story.` };
  const sub = `${workouts} ${workouts === 1 ? "workout" : "workouts"} in ${monthLabel}. Here's everything you built.`;
  if (firstMonth) return { headline: `${who}IT STARTS HERE.`, subline: sub };
  if (lastMonth === 0) return { headline: `${who}YOU'RE BACK.`, subline: sub };
  if (workouts >= lastMonth || (weeksCounted > 0 && weeksMet === weeksCounted)) return { headline: `${who}YOU SHOWED UP.`, subline: sub };
  return { headline: `${who}KEEP BUILDING.`, subline: sub };
}

function insightFor(d: Pick<ReportData, "workouts" | "prs" | "weeks" | "weeksMet" | "weeklyGoal" | "workoutsVsLastMonth" | "nextBadges" | "daysTrained">): string {
  if (d.workouts === 0) return "One workout gets the month going. Start light and build from there.";
  if (d.prs.length >= 3) return `${d.prs.length} new records this month. Your strength is climbing.`;
  const counted = d.weeks.filter((w) => w.metTarget !== null).length;
  if (d.weeklyGoal && counted > 0 && d.weeksMet === counted) return "Every week hit your target. That's real consistency.";
  if (d.workoutsVsLastMonth != null && d.workoutsVsLastMonth > 0) return `${d.workoutsVsLastMonth} more ${d.workoutsVsLastMonth === 1 ? "workout" : "workouts"} than last month. Keep that pace.`;
  const close = d.nextBadges.find((b) => b.progress / b.target >= 0.75);
  if (close) return `${close.title} is within reach. Keep going.`;
  return `${d.daysTrained} training ${d.daysTrained === 1 ? "day" : "days"} this month. Every one counts.`;
}

export function buildReport(input: ReportInput): ReportData {
  const { month, todayKey } = input;
  const { start, end: monthEnd } = monthBounds(month);
  const isCurrentMonth = todayKey.slice(0, 7) === month;
  const end = isCurrentMonth ? todayKey : monthEnd;
  const daysSoFar = daysBetween(start, end) + 1;

  const monthWorkouts = input.workouts.filter((w) => inRange(dayKey(w.date), start, end));
  const prev = monthBounds(previousMonth(month));
  const lastMonthWorkouts = input.workouts.filter((w) => inRange(dayKey(w.date), prev.start, prev.end));

  const sessions = groupSessions(monthWorkouts);
  const workouts = sessions.length;
  const lastMonthSessions = groupSessions(lastMonthWorkouts).length;
  const trainedDays = new Set(monthWorkouts.map((w) => dayKey(w.date)));
  const volumeKg = monthWorkouts.reduce((v, w) => v + volumeOf(w), 0);

  // Best month for volume: beats every earlier month that has any training.
  const earlierMonths = new Map<string, number>();
  for (const w of input.workouts) {
    const m = dayKey(w.date).slice(0, 7);
    if (m < month) earlierMonths.set(m, (earlierMonths.get(m) ?? 0) + volumeOf(w));
  }
  const bestVolumeMonth = volumeKg > 0 && earlierMonths.size > 0 && [...earlierMonths.values()].every((v) => volumeKg > v);

  const run = longestRunOf(trainedDays, start, end);
  const runOngoing = isCurrentMonth && run.endsOn != null && run.length > 1 && daysBetween(run.endsOn, todayKey) <= 1;

  // Weeks: only those that have started.
  const weeklyGoal = input.weeklyGoal;
  const weekRanges = monthWeeks(start, monthEnd).filter((w) => w.start <= end);
  const weeks: ReportWeek[] = weekRanges.map((range, i) => {
    const inWeek = monthWorkouts.filter((w) => inRange(dayKey(w.date), range.start, range.end));
    const count = groupSessions(inWeek).length;
    return { label: `Week ${i + 1}`, start: range.start, end: range.end, workouts: count, volumeKg: inWeek.reduce((v, w) => v + volumeOf(w), 0), metTarget: weeklyGoal ? count >= weeklyGoal : null, best: false };
  });
  const bestCount = Math.max(0, ...weeks.map((w) => w.workouts));
  const bestWeek = weeks.find((w) => w.workouts === bestCount && bestCount > 0);
  if (bestWeek && weeks.length > 1) bestWeek.best = true;
  const weeksMet = weeks.filter((w) => w.metTarget).length;

  // Records set this month, and the exact sets that set them.
  const prs: ReportPR[] = prEventsFor(input.workouts)
    .filter((e) => inRange(e.date, start, end))
    .map((e) => ({ exercise: e.exercise, date: e.date, weightKg: e.set.weight, reps: e.set.reps, previousKg: e.previous.weight, previousReps: e.previous.reps }));
  const prDays = new Set(prs.map((p) => p.date));

  // Muscle groups by sets, the app's split (biceps, triceps and forearms apart).
  const groupSets = new Map<string, number>();
  for (const w of monthWorkouts) {
    const group = muscleGroupOf(w, input.customArms);
    groupSets.set(group, (groupSets.get(group) ?? 0) + w.sets.length);
  }
  const muscles = [...groupSets].map(([group, sets]) => ({ group: group === "Abs" ? "Core" : group, sets })).sort((a, b) => b.sets - a.sets);
  const totalSets = monthWorkouts.reduce((n, w) => n + w.sets.length, 0);
  const totalReps = monthWorkouts.reduce((n, w) => n + w.sets.reduce((r, s) => r + s.reps, 0), 0);

  const byExercise = new Map<string, ReportExercise>();
  for (const w of monthWorkouts) {
    const key = w.exercise.trim().toLowerCase();
    const entry = byExercise.get(key) ?? { name: w.exercise, sets: 0, topWeightKg: 0, topReps: 0, volumeKg: 0 };
    for (const s of w.sets) {
      entry.sets += 1;
      entry.volumeKg += s.weight * s.reps;
      if (s.weight > entry.topWeightKg || (s.weight === entry.topWeightKg && s.reps > entry.topReps)) {
        entry.topWeightKg = s.weight;
        entry.topReps = s.reps;
      }
    }
    byExercise.set(key, entry);
  }
  let heaviest: ReportData["heaviest"] = null;
  for (const e of byExercise.values()) if (e.topWeightKg > 0 && (!heaviest || e.topWeightKg > heaviest.weightKg)) heaviest = { exercise: e.name, weightKg: e.topWeightKg, reps: e.topReps };
  const topExercises = [...byExercise.values()].sort((a, b) => b.volumeKg - a.volumeKg || b.sets - a.sets).slice(0, 5);
  const lastMonthVolume = lastMonthWorkouts.reduce((v, w) => v + volumeOf(w), 0);
  const volumeVsLastMonthPct = lastMonthVolume > 0 ? Math.round(((volumeKg - lastMonthVolume) / lastMonthVolume) * 100) : null;

  const calendar: ReportData["calendar"] = [];
  for (let d = start; d <= monthEnd; d = addDays(d, 1)) calendar.push({ date: d, trained: trainedDays.has(d), pr: prDays.has(d), future: d > end });

  // Body weight: the month's weigh-ins.
  const weightRows = input.weights
    .map((w) => ({ date: dayKey(w.date), kg: w.weight }))
    .filter((w) => inRange(w.date, start, end))
    .sort((a, b) => a.date.localeCompare(b.date));
  let body: ReportData["body"] = null;
  if (weightRows.length > 0) {
    const startKg = weightRows[0].kg;
    const latestKg = weightRows[weightRows.length - 1].kg;
    const goal = input.goalWeightKg;
    const towardGoal = goal == null || weightRows.length < 2 || latestKg === startKg ? null : Math.abs(latestKg - goal) < Math.abs(startKg - goal);
    body = { startKg, latestKg, changeKg: Math.round((latestKg - startKg) * 10) / 10, checkIns: weightRows.length, points: weightRows, towardGoal };
  }

  // Badges.
  const badges: ReportBadge[] = input.achievements
    .filter((a) => a.unlockedAt && inRange(dayKey(a.unlockedAt), start, end))
    .sort((a, b) => a.unlockedAt!.localeCompare(b.unlockedAt!))
    .map((a) => ({ title: a.title, tier: a.tier, date: dayKey(a.unlockedAt!) }));
  const nextBadges: ReportNextBadge[] = input.achievements
    .filter((a) => !a.unlockedAt && a.targetValue > 0 && a.progress > 0)
    .sort((a, b) => b.progress / b.targetValue - a.progress / a.targetValue)
    .slice(0, 2)
    .map((a) => ({ title: a.title, progress: Math.min(a.progress, a.targetValue), target: a.targetValue }));
  const badgeRows = [...input.achievements]
    .sort((a, b) => (a.unlockedAt && b.unlockedAt ? b.unlockedAt.localeCompare(a.unlockedAt) : a.unlockedAt ? -1 : b.unlockedAt ? 1 : b.progress / (b.targetValue || 1) - a.progress / (a.targetValue || 1)))
    .map((a) => ({ title: a.title, tier: a.tier, unlockedAt: a.unlockedAt ? dayKey(a.unlockedAt) : null, progress: Math.min(a.progress, a.targetValue), target: a.targetValue }));

  // One row per set. A record is marked on the set that set it.
  const prKeys = new Set(prs.map((p) => `${p.date}|${p.exercise.trim().toLowerCase()}|${p.weightKg}|${p.reps}`));
  const setRows: ReportData["setRows"] = [];
  const ordered = [...monthWorkouts].sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)) || a.createdAt.localeCompare(b.createdAt));
  for (const w of ordered) {
    const date = dayKey(w.date);
    const sets = [...w.sets].sort((a, b) => a.setNumber - b.setNumber);
    sets.forEach((s, i) => {
      const key = `${date}|${w.exercise.trim().toLowerCase()}|${s.weight}|${s.reps}`;
      const pr = prKeys.delete(key);
      const notes = [i === 0 ? (w.notes ?? "").trim() : "", s.weight === 0 ? "Bodyweight" : ""].filter(Boolean).join(" · ");
      setRows.push({ date, category: w.category === "Abs" ? "Core" : w.category, exercise: w.exercise, set: i + 1, reps: s.reps, weightKg: s.weight, notes, pr });
    });
  }

  const label = monthName(month);
  const weeksCounted = weeks.filter((w) => w.metTarget !== null).length;
  const { headline, subline } = headlineFor(input.firstName, workouts, lastMonthSessions, earlierMonths.size === 0, weeksMet, weeksCounted, MONTHS[Number(month.slice(5, 7)) - 1]);
  const partial = { workouts, prs, weeks, weeksMet, weeklyGoal, workoutsVsLastMonth: lastMonthSessions > 0 ? workouts - lastMonthSessions : null, nextBadges, daysTrained: trainedDays.size };

  return {
    month,
    monthName: label,
    rangeLabel: `${shortDay(start)} – ${shortDay(end)} ${month.slice(0, 4)}`,
    start,
    end,
    daysSoFar,
    isCurrentMonth,
    headline,
    subline,
    workouts,
    workoutsVsLastMonth: partial.workoutsVsLastMonth,
    daysTrained: trainedDays.size,
    volumeKg,
    bestVolumeMonth,
    longestRun: run.length,
    runOngoing,
    weeklyGoal,
    weeks,
    weeksMet,
    prs,
    muscles,
    totalSets,
    totalReps,
    topExercises,
    heaviest,
    volumeVsLastMonthPct,
    calendar,
    body,
    badges,
    nextBadges,
    insight: insightFor(partial),
    setRows,
    weightRows,
    badgeRows,
  };
}

/** "Mon" … "Sun" column of a date: 0 = Monday. */
export const weekdayIndex = (key: string) => (parseLocalDate(key).getDay() + 6) % 7;
