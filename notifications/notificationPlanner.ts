import type { BodyWeight, Workout } from "../services/api";

export type NotificationType =
  | "daily_reminder"
  | "streak_at_risk"
  | "inactivity"
  | "weekly_summary"
  | "motivation";

export type NotificationPriority = 1 | 2 | 3 | 4 | 5;

export interface NotificationState {
  workouts: Workout[];
  weights: BodyWeight[];
  displayName?: string | null;
  weeklyGoal?: number;
}

export interface NotificationPreferences {
  enabled: boolean;
  dailyReminder: boolean;
  streakReminders: boolean;
  inactivityReminders: boolean;
  weeklySummary: boolean;
  motivationalMessages: boolean;
  dailyReminderTime: string;
  streakReminderTime: string;
  inactivityReminderTime: string;
  weeklySummaryTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
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

const MOTIVATION_MESSAGES = [
  {
    title: "Small steps count",
    body: "A little progress today still moves you forward, {name}.",
  },
  {
    title: "Keep your momentum",
    body: "You do not need a perfect session. Just keep showing up, {name}.",
  },
  {
    title: "Your future self is watching",
    body: "Give yourself something to be proud of today, {name}.",
  },
  {
    title: "Progress over perfection",
    body: "Consistency beats intensity. Keep your rhythm, {name}.",
  },
];

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function parseTime(value: string, fallback: string): [number, number] {
  const [rawHour, rawMinute] = value.split(":").map(Number);
  const [fallbackHour, fallbackMinute] = fallback.split(":").map(Number);
  const hour = Number.isInteger(rawHour) && rawHour >= 0 && rawHour <= 23 ? rawHour : fallbackHour;
  const minute = Number.isInteger(rawMinute) && rawMinute >= 0 && rawMinute <= 59 ? rawMinute : fallbackMinute;
  return [hour, minute];
}

function dateAtTime(dateKey: string, time: string, fallback = "09:00"): Date {
  const date = parseDateKey(dateKey);
  const [hour, minute] = parseTime(time, fallback);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function replaceName(template: string, displayName?: string | null): string {
  const name = displayName?.trim() || "there";
  return template.replaceAll("{name}", name);
}

function isQuietHour(date: Date, prefs: NotificationPreferences): boolean {
  const [startHour, startMinute] = parseTime(prefs.quietHoursStart, "22:00");
  const [endHour, endMinute] = parseTime(prefs.quietHoursEnd, "07:00");
  const minutes = date.getHours() * 60 + date.getMinutes();
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  if (start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

function moveOutsideQuietHours(date: Date, prefs: NotificationPreferences): Date {
  if (!isQuietHour(date, prefs)) return date;

  const [startHour, startMinute] = parseTime(prefs.quietHoursStart, "22:00");
  const [endHour, endMinute] = parseTime(prefs.quietHoursEnd, "07:00");
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const result = new Date(date);

  if (start < end || result.getHours() * 60 + result.getMinutes() < end) {
    result.setHours(endHour, endMinute, 0, 0);
    return result;
  }

  result.setDate(result.getDate() + 1);
  result.setHours(endHour, endMinute, 0, 0);
  return result;
}

function workoutDateKeys(workouts: Workout[]): string[] {
  return [...new Set(workouts.map((workout) => workout.date))].sort();
}

function currentStreak(workoutDates: string[], now: Date): number {
  const dates = [...new Set(workoutDates)].sort().reverse();
  if (dates.length === 0) return 0;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = addDays(today, -1);
  const todayKey = localDateKey(today);
  const yesterdayKey = localDateKey(yesterday);
  if (dates[0] !== todayKey && dates[0] !== yesterdayKey) return 0;

  let streak = 0;
  let expected = parseDateKey(dates[0]);
  for (const date of dates) {
    if (date !== localDateKey(expected)) break;
    streak += 1;
    expected = addDays(expected, -1);
  }
  return streak;
}

function weeklyMotivationDates(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
    if (date.getDay() === 2 || date.getDay() === 4) dates.push(date);
  }
  return dates;
}

export function planNotifications(
  state: NotificationState,
  now: Date,
  prefs: NotificationPreferences,
): PlannedNotification[] {
  if (!prefs.enabled) return [];

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, 13);
  const todayKey = localDateKey(start);
  const workoutDates = workoutDateKeys(state.workouts);
  const workoutDateSet = new Set(workoutDates);
  const workedOutToday = workoutDateSet.has(todayKey);
  const streak = currentStreak(workoutDates, now);
  const candidates: PlannedNotification[] = [];

  const addCandidate = (
    type: NotificationType,
    date: Date,
    priority: NotificationPriority,
    title: string,
    body: string,
  ) => {
    const scheduledDate = moveOutsideQuietHours(date, prefs);
    if (scheduledDate <= now) return;
    if (workedOutToday && localDateKey(scheduledDate) === todayKey) return;
    candidates.push({
      id: `iron-arc-${type}-${localDateKey(scheduledDate)}`,
      type,
      date: scheduledDate,
      priority,
      title: replaceName(title, state.displayName),
      body: replaceName(body, state.displayName),
      data: { type },
    });
  };

  for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
    const dateKey = localDateKey(date);
    if (!workoutDateSet.has(dateKey) && prefs.dailyReminder) {
      addCandidate(
        "daily_reminder",
        dateAtTime(dateKey, prefs.dailyReminderTime),
        2,
        "Time to train",
        "Ready for a session, {name}? A little progress goes a long way.",
      );
    }
  }

  if (prefs.streakReminders && streak > 0 && !workedOutToday) {
    addCandidate(
      "streak_at_risk",
      dateAtTime(todayKey, prefs.streakReminderTime, "20:00"),
      1,
      `${streak}-day streak at risk`,
      "A short session tonight keeps your momentum alive, {name}.",
    );
  }

  const lastWorkout = workoutDates.length > 0 ? workoutDates[workoutDates.length - 1] : null;
  if (prefs.inactivityReminders && lastWorkout) {
    const inactivityDate = addDays(parseDateKey(lastWorkout), 3);
    if (inactivityDate >= start && inactivityDate <= end && !workoutDateSet.has(localDateKey(inactivityDate))) {
      addCandidate(
        "inactivity",
        dateAtTime(localDateKey(inactivityDate), prefs.inactivityReminderTime, "10:00"),
        3,
        "Ready when you are",
        "Three days away is enough. A manageable session can restart your rhythm, {name}.",
      );
    }
  }

  if (prefs.weeklySummary) {
    for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
      if (date.getDay() === 0) {
        addCandidate(
          "weekly_summary",
          dateAtTime(localDateKey(date), prefs.weeklySummaryTime, "18:00"),
          4,
          "Your week in review",
          "Take a moment to see what you built this week, {name}.",
        );
      }
    }
  }

  if (prefs.motivationalMessages) {
    for (const date of weeklyMotivationDates(start, end)) {
      const index = Math.floor((date.getTime() - start.getTime()) / 86_400_000) % MOTIVATION_MESSAGES.length;
      const message = MOTIVATION_MESSAGES[index];
      addCandidate(
        "motivation",
        dateAtTime(localDateKey(date), "12:30"),
        5,
        message.title,
        message.body,
      );
    }
  }

  const selectedByDate = new Map<string, PlannedNotification>();
  for (const candidate of candidates.sort((a, b) => a.date.getTime() - b.date.getTime() || a.priority - b.priority)) {
    const dateKey = localDateKey(candidate.date);
    const current = selectedByDate.get(dateKey);
    if (!current || candidate.priority < current.priority) {
      selectedByDate.set(dateKey, candidate);
    }
  }

  return [...selectedByDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  dailyReminder: true,
  streakReminders: true,
  inactivityReminders: true,
  weeklySummary: true,
  motivationalMessages: true,
  dailyReminderTime: "09:00",
  streakReminderTime: "20:00",
  inactivityReminderTime: "10:00",
  weeklySummaryTime: "18:00",
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};
