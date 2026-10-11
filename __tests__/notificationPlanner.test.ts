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

function preferences(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    streakReminders: false,
    inactivityReminders: false,
    weeklySummary: false,
    motivationalMessages: false,
    ...overrides,
  };
}

describe("planNotifications", () => {
  it("plans one daily reminder for each of the next 14 days", () => {
    const result = planNotifications(
      { workouts: [], weights: [], displayName: "Alex" },
      new Date(2026, 9, 1, 8, 0),
      preferences(),
    );

    expect(result).toHaveLength(14);
    expect(result[0].type).toBe("daily_reminder");
    expect(result[0].body).toContain("Alex");
    expect(result[13].date.getDate()).toBe(14);
  });

  it("keeps only the higher-priority streak reminder on a collision day", () => {
    const result = planNotifications(
      { workouts: [workout("2026-09-30")], weights: [] },
      new Date(2026, 9, 1, 8, 0),
      preferences({ streakReminders: true }),
    );

    const today = result.filter((item) => item.date.getDate() === 1);
    expect(today).toHaveLength(1);
    expect(today[0].type).toBe("streak_at_risk");
  });

  it("skips today's notifications after a workout today", () => {
    const result = planNotifications(
      { workouts: [workout("2026-10-01")], weights: [] },
      new Date(2026, 9, 1, 8, 0),
      preferences({ streakReminders: true }),
    );

    expect(result.some((item) => item.date.getDate() === 1)).toBe(false);
  });

  it("moves notifications outside overnight quiet hours", () => {
    const result = planNotifications(
      { workouts: [], weights: [] },
      new Date(2026, 9, 1, 8, 0),
      preferences({ dailyReminderTime: "23:00", quietHoursStart: "22:00", quietHoursEnd: "07:00" }),
    );

    expect(result[0].date.getDate()).toBe(2);
    expect(result[0].date.getHours()).toBe(7);
  });

  it("plans inactivity, weekly summary, and two rotating messages", () => {
    const result = planNotifications(
      { workouts: [workout("2026-09-28")], weights: [] },
      new Date(2026, 9, 1, 8, 0),
      preferences({
        dailyReminder: false,
        inactivityReminders: true,
        weeklySummary: true,
        motivationalMessages: true,
      }),
    );

    expect(result.some((item) => item.type === "inactivity")).toBe(true);
    expect(result.some((item) => item.type === "weekly_summary")).toBe(true);
    expect(result.filter((item) => item.type === "motivation").length).toBeGreaterThan(0);
  });

  it("returns no schedule when notifications are disabled", () => {
    expect(
      planNotifications(
        { workouts: [], weights: [] },
        new Date(2026, 9, 1),
        preferences({ enabled: false }),
      ),
    ).toEqual([]);
  });
});
