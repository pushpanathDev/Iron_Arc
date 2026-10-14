import type { BodyWeight, Workout } from "../services/api";

/*
 * Plans the next two weeks of local reminders from the user's own data. Pure:
 * the service schedules what this returns, and re-plans whenever workouts,
 * the profile or the settings change (and when the app comes to the front),
 * so a reminder never fires about something already done.
 */

export type NotificationType = "daily_reminder" | "goal_at_risk" | "inactivity" | "weekly_summary" | "weigh_in";

export type NotificationPriority = 1 | 2 | 3 | 4;

export interface NotificationState {
  workouts: Workout[];
  weights: BodyWeight[];
  displayName?: string | null;
  /** Training days per week (mirrors trainingDays.length when set). */
  weeklyGoal?: number | null;
  /** ISO weekdays the user trains on (1 = Mon … 7 = Sun). Training reminders go out only on these. */
  trainingDays?: number[] | null;
}

export interface NotificationPreferences {
  enabled: boolean;
  /** "Time to train" on training days not yet logged. */
  dailyReminder: boolean;
  /** Weekly goal check: the evening it becomes "train today or miss the goal". (Stored name kept.) */
  streakReminders: boolean;
  /** Comeback nudge after three days without a workout. */
  inactivityReminders: boolean;
  /** Sunday evening review. */
  weeklySummary: boolean;
  /** Alert when the rest timer ends while the app is in the background. */
  restTimerAlert: boolean;
  dailyReminderTime: string;
  streakReminderTime: string;
  inactivityReminderTime: string;
  weeklySummaryTime: string;
  /** Days for the training reminder (ISO 1 = Mon); null = the profile's training days. */
  reminderDays: number[] | null;
  /** No training reminder on a day already logged. */
  skipIfTrained: boolean;
  /** Morning weigh-in reminder on chosen days, skipped once a weight is logged that day. */
  weighIn: boolean;
  weighInDays: number[];
  weighInTime: string;
  /** Rest timer: default length when an exercise has none, and how the end alert sounds. */
  restDefaultSeconds: number;
  restSound: boolean;
  restVibrate: boolean;
}

export interface PlannedNotification {
  id: string;
  type: NotificationType;
  date: Date;
  priority: NotificationPriority;
  title: string;
  body: string;
  data: Record<string, string>;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  dailyReminder: true,
  streakReminders: true,
  inactivityReminders: true,
  weeklySummary: true,
  restTimerAlert: true,
  dailyReminderTime: "09:00",
  streakReminderTime: "19:00",
  inactivityReminderTime: "10:00",
  weeklySummaryTime: "18:00",
  reminderDays: null,
  skipIfTrained: true,
  weighIn: false,
  weighInDays: [1, 4],
  weighInTime: "07:00",
  restDefaultSeconds: 90,
  restSound: true,
  restVibrate: true,
};

export const REST_MIN_SECONDS = 30;
export const REST_MAX_SECONDS = 300;

/**
 * The words each reminder uses. The planner sends these and the settings
 * screen previews them, so the preview is always what really arrives.
 */
export const COPY = {
  daily_reminder: (name: string) => ({ title: "Time to train", body: `Your session is waiting${name ? `, ${name}` : ""}. Log it when you're done.` }),
  goal_at_risk: (streakWeeks: number, needed: number, goal: number) => ({
    title: streakWeeks > 0 ? `Keep your ${plural(streakWeeks, "week")} streak` : "Your weekly goal needs today",
    body: needed === 1 ? `Train today to reach ${plural(goal, "day")} this week.` : `You need ${needed} more days this week: today and every day after.`,
  }),
  inactivity: (name: string) => ({ title: "Ready for a comeback?", body: `It's been 3 days. A short session gets the rhythm back${name ? `, ${name}` : ""}.` }),
  weekly_summary: (days: number, goal: number | null) => ({
    title: "Your week in review",
    body:
      days === 0
        ? "See how your week went in Analytics."
        : goal && days < goal
          ? `${days} of ${goal} training days this week. See your progress.`
          : `${plural(days, "training day")} this week${goal ? ", goal reached" : ""}. See your progress.`,
  }),
  weigh_in: () => ({ title: "Morning weigh-in", body: "Step on the scale before breakfast and log it. Same time, same conditions." }),
};

const PLAN_DAYS = 14;
const COMEBACK_AFTER_DAYS = 3;

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function parseTime(value: string, fallback: string): [number, number] {
  const [h, m] = value.split(":").map(Number);
  const [fh, fm] = fallback.split(":").map(Number);
  return [Number.isInteger(h) && h >= 0 && h <= 23 ? h : fh, Number.isInteger(m) && m >= 0 && m <= 59 ? m : fm];
}

function dateAtTime(dateKey: string, time: string, fallback: string): Date {
  const date = parseDateKey(dateKey);
  const [h, m] = parseTime(time, fallback);
  date.setHours(h, m, 0, 0);
  return date;
}

const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;
/** Monday of the date's week. */
const weekStartOf = (d: Date) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -(isoWeekday(d) - 1));
const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] || "";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Weeks in a row that met the goal, counting back from last week (this week counts once met). */
function weeklyStreak(trained: Set<string>, goal: number, today: Date): number {
  const daysIn = (monday: Date) => {
    let n = 0;
    for (let i = 0; i < 7; i++) if (trained.has(localDateKey(addDays(monday, i)))) n++;
    return n;
  };
  const thisWeek = weekStartOf(today);
  let week = daysIn(thisWeek) >= goal ? thisWeek : addDays(thisWeek, -7);
  let streak = 0;
  while (daysIn(week) >= goal) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

export function planNotifications(state: NotificationState, now: Date, prefs: NotificationPreferences): PlannedNotification[] {
  if (!prefs.enabled) return [];

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = addDays(start, PLAN_DAYS - 1);
  const trained = new Set(state.workouts.map((w) => w.date.slice(0, 10)));
  const name = firstName(state.displayName);
  const candidates: PlannedNotification[] = [];

  const add = (type: NotificationType, date: Date, priority: NotificationPriority, copy: { title: string; body: string }, evenIfTrained = false) => {
    if (date <= now) return;
    // Nothing more about a logged day (unless the user asked for the reminder anyway).
    if (!evenIfTrained && trained.has(localDateKey(date))) return;
    candidates.push({ id: `iron-arc-${type}-${localDateKey(date)}`, type, date, priority, ...copy, data: { type } });
  };

  const profileDays = state.trainingDays?.length ? new Set(state.trainingDays) : null;
  // Reminder days: the user's own pick, else the profile's training days, else every day.
  const reminderDays = prefs.reminderDays ? new Set(prefs.reminderDays) : profileDays;
  const goal = state.trainingDays?.length ? state.trainingDays.length : state.weeklyGoal && state.weeklyGoal > 0 ? state.weeklyGoal : null;
  const streak = goal ? weeklyStreak(trained, goal, start) : 0;

  for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
    const key = localDateKey(day);

    // Training-day reminder.
    if (prefs.dailyReminder && (!reminderDays || reminderDays.has(isoWeekday(day)))) {
      add("daily_reminder", dateAtTime(key, prefs.dailyReminderTime, "09:00"), 2, COPY.daily_reminder(name), !prefs.skipIfTrained);
    }

    // Weekly goal check: only the evening it becomes "every day left, starting today".
    if (prefs.streakReminders && goal && !trained.has(key)) {
      const monday = weekStartOf(day);
      let doneBefore = 0;
      for (let d = new Date(monday); d < day; d = addDays(d, 1)) if (trained.has(localDateKey(d))) doneBefore++;
      const needed = goal - doneBefore;
      const daysLeft = 8 - isoWeekday(day); // today through Sunday
      if (needed > 0 && needed === daysLeft) {
        const isThisWeek = localDateKey(monday) === localDateKey(weekStartOf(start));
        add("goal_at_risk", dateAtTime(key, prefs.streakReminderTime, "19:00"), 1, COPY.goal_at_risk(isThisWeek ? streak : 0, needed, goal));
      }
    }
  }

  // Comeback nudge after a few days off.
  const lastWorkout = [...trained].sort().pop();
  if (prefs.inactivityReminders && lastWorkout) {
    const nudge = addDays(parseDateKey(lastWorkout), COMEBACK_AFTER_DAYS);
    if (nudge >= start && nudge <= end) {
      add("inactivity", dateAtTime(localDateKey(nudge), prefs.inactivityReminderTime, "10:00"), 3, COPY.inactivity(name));
    }
  }

  // Sunday review: this week's real numbers so far (re-planned as you log).
  if (prefs.weeklySummary) {
    for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
      if (isoWeekday(day) !== 7) continue;
      const monday = weekStartOf(day);
      const isThisWeek = localDateKey(monday) === localDateKey(weekStartOf(start));
      let days = 0;
      for (let i = 0; i < 7; i++) if (trained.has(localDateKey(addDays(monday, i)))) days++;
      const date = dateAtTime(localDateKey(day), prefs.weeklySummaryTime, "18:00");
      if (date <= now) continue;
      candidates.push({
        id: `iron-arc-weekly_summary-${localDateKey(day)}`,
        type: "weekly_summary",
        date,
        priority: 4,
        ...COPY.weekly_summary(isThisWeek ? days : 0, goal),
        data: { type: "weekly_summary" },
      });
    }
  }

  // Weigh-in: chosen mornings, skipped once a weight is logged that day.
  if (prefs.weighIn && prefs.weighInDays.length) {
    const weighed = new Set(state.weights.map((w) => w.date.slice(0, 10)));
    const days = new Set(prefs.weighInDays);
    for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
      const key = localDateKey(day);
      const date = dateAtTime(key, prefs.weighInTime, "07:00");
      if (!days.has(isoWeekday(day)) || weighed.has(key) || date <= now) continue;
      candidates.push({ id: `iron-arc-weigh_in-${key}`, type: "weigh_in", date, priority: 4, ...COPY.weigh_in(), data: { type: "weigh_in" } });
    }
  }

  // At most one training nudge a day (the most important); the Sunday review and weigh-in are extra.
  const byDay = new Map<string, PlannedNotification>();
  const reviews: PlannedNotification[] = [];
  for (const c of candidates.sort((a, b) => a.date.getTime() - b.date.getTime() || a.priority - b.priority)) {
    if (c.type === "weekly_summary" || c.type === "weigh_in") {
      reviews.push(c);
      continue;
    }
    const key = localDateKey(c.date);
    const current = byDay.get(key);
    if (!current || c.priority < current.priority) byDay.set(key, c);
  }
  return [...byDay.values(), ...reviews].sort((a, b) => a.date.getTime() - b.date.getTime());
}
