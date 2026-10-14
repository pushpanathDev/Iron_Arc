import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferences,
  planNotifications,
} from "../notifications/notificationPlanner";
import type { Workout } from "../services/api";

function workout(date: string): Workout {
  return {
    id: date,
    userId: "user1",
    date,
    exercise: "Squat",
    category: "Legs",
    notes: null,
    sets: [],
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
  };
}

/** Only the reminder under test switched on. */
function preferences(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    dailyReminder: false,
    streakReminders: false,
    inactivityReminders: false,
    weeklySummary: false,
    ...overrides,
  };
}

// 1 Oct 2026 is a Thursday.
const THU_8AM = new Date(2026, 9, 1, 8, 0);

describe("planNotifications", () => {
  it("training-day reminders go out only on the chosen days", () => {
    const result = planNotifications({ workouts: [], weights: [], displayName: "Alex Doe", trainingDays: [1, 3, 5] }, THU_8AM, preferences({ dailyReminder: true }));
    const weekdays = result.map((n) => ((n.date.getDay() + 6) % 7) + 1);
    expect(new Set(weekdays)).toEqual(new Set([1, 3, 5]));
    expect(result).toHaveLength(6); // two weeks × three days
    expect(result[0].body).toContain("Alex"); // first name only
    expect(result[0].body).not.toContain("Doe");
  });

  it("without chosen days, a reminder each of the next 14 days", () => {
    const result = planNotifications({ workouts: [], weights: [] }, THU_8AM, preferences({ dailyReminder: true }));
    expect(result).toHaveLength(14);
    expect(result[13].date.getDate()).toBe(14);
  });

  it("nothing more today once today's workout is logged", () => {
    const result = planNotifications({ workouts: [workout("2026-10-01")], weights: [] }, THU_8AM, preferences({ dailyReminder: true }));
    expect(result.some((n) => n.date.getDate() === 1)).toBe(false);
  });

  it("weekly goal check fires only when every day left is needed", () => {
    // Goal 4 (Mon, Tue, Thu, Fri); trained Mon only. Thu: need 3 with Thu–Sun (4 days) left → not yet.
    // Fri: need 3 with Fri–Sun (3 days) left → yes, Friday evening.
    const result = planNotifications(
      { workouts: [workout("2026-09-28")], weights: [], trainingDays: [1, 2, 4, 5] },
      THU_8AM,
      preferences({ streakReminders: true }),
    );
    const thisWeek = result.filter((n) => n.date.getDate() <= 4);
    expect(thisWeek.map((n) => [n.type, n.date.getDate(), n.date.getHours()])).toEqual([["goal_at_risk", 2, 19]]);
    expect(thisWeek[0].body).toBe("You need 3 more days this week: today and every day after.");
  });

  it("goal check names the weekly streak when there is one", () => {
    // Last week (21–27 Sep) met a 2-day goal; this week nothing yet. Sat: need 2 with 2 days left.
    const result = planNotifications(
      { workouts: [workout("2026-09-22"), workout("2026-09-24")], weights: [], weeklyGoal: 2 },
      THU_8AM,
      preferences({ streakReminders: true }),
    );
    const saturday = result.find((n) => n.date.getDate() === 3);
    expect(saturday?.title).toBe("Keep your 1 week streak");
  });

  it("the higher-priority nudge wins a shared day", () => {
    const result = planNotifications(
      { workouts: [workout("2026-09-28")], weights: [], trainingDays: [1, 2, 4, 5] },
      THU_8AM,
      preferences({ dailyReminder: true, streakReminders: true }),
    );
    const friday = result.filter((n) => n.date.getDate() === 2);
    expect(friday.map((n) => n.type)).toEqual(["goal_at_risk"]);
  });

  it("comeback nudge three days after the last workout", () => {
    const result = planNotifications({ workouts: [workout("2026-09-30")], weights: [] }, THU_8AM, preferences({ inactivityReminders: true }));
    expect(result.map((n) => [n.type, n.date.getDate()])).toEqual([["inactivity", 3]]);
  });

  it("Sunday review counts this week's training days, alongside a nudge", () => {
    const result = planNotifications(
      { workouts: [workout("2026-09-28"), workout("2026-09-29")], weights: [], trainingDays: [7] },
      THU_8AM,
      preferences({ weeklySummary: true, dailyReminder: true }),
    );
    const sunday = result.filter((n) => n.date.getDate() === 4);
    expect(sunday.map((n) => n.type)).toEqual(["daily_reminder", "weekly_summary"]);
    expect(sunday[1].body).toBe("2 training days this week, goal reached. See your progress.");
  });

  it("returns no schedule when notifications are off", () => {
    expect(planNotifications({ workouts: [], weights: [] }, THU_8AM, preferences({ enabled: false, dailyReminder: true }))).toEqual([]);
  });

  it("reminder days can differ from profile days", () => {
    const result = planNotifications({ workouts: [], weights: [], trainingDays: [1, 3, 5] }, THU_8AM, preferences({ dailyReminder: true, reminderDays: [2, 4] }));
    expect(new Set(result.map((n) => ((n.date.getDay() + 6) % 7) + 1))).toEqual(new Set([2, 4]));
  });

  it("with skip-if-trained off, the reminder still comes on a logged day", () => {
    const result = planNotifications({ workouts: [workout("2026-10-01")], weights: [] }, THU_8AM, preferences({ dailyReminder: true, skipIfTrained: false }));
    expect(result.some((n) => n.date.getDate() === 1 && n.type === "daily_reminder")).toBe(true);
  });

  it("weigh-in on chosen mornings, skipped once weighed, alongside a nudge", () => {
    const weights = [{ id: "w", userId: "u", date: "2026-10-05", weight: 80, weekStart: null } as never];
    const result = planNotifications(
      { workouts: [], weights },
      new Date(2026, 9, 1, 6, 0),
      preferences({ weighIn: true, weighInDays: [1, 4], weighInTime: "07:00", dailyReminder: true }),
    );
    const weighIns = result.filter((n) => n.type === "weigh_in").map((n) => n.date.getDate());
    expect(weighIns).toEqual([1, 8, 12]); // Thu 1, Thu 8, Mon 12 (Mon 5 already weighed)
    expect(result.filter((n) => n.date.getDate() === 1).map((n) => n.type).sort()).toEqual(["daily_reminder", "weigh_in"]);
  });
});
