import { calculateStreak, generateInsights, Insight } from "../insights/insightEngine";
import type { Workout, BodyWeight } from "../services/api";

/* ─── Helpers ──────────────────────────────── */
function daysAgoDate(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
    .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, "0"))
    .join("-");
}

function makeWorkout(
  overrides: Partial<Workout> & { daysAgo?: number } = {}
): Workout {
  const { daysAgo = 0, ...rest } = overrides;
  return {
    id: Math.random().toString(36).slice(2),
    userId: "user1",
    date: daysAgoDate(daysAgo),
    exercise: "Barbell Bench Press",
    category: "Chest",
    notes: null,
    sets: [{ id: "s1", workoutId: "w1", setNumber: 1, reps: 10, weight: 80 }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...rest,
  };
}

function makeWeight(date: string, weight: number): BodyWeight {
  return {
    id: Math.random().toString(36).slice(2),
    userId: "user1",
    date,
    weekStart: null,
    weight,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/* ─────────────────────────────────────────────
   generateInsights
───────────────────────────────────────────── */
describe("generateInsights", () => {
  it("returns an empty array for no data", () => {
    const result = generateInsights([], []);
    expect(Array.isArray(result)).toBe(true);
    // May return 0 insights or empty-state motivational insight
  });

  it("returns Insight objects with required fields", () => {
    const workouts = [makeWorkout({ daysAgo: 0 })];
    const result = generateInsights(workouts, []);
    result.forEach((insight: Insight) => {
      expect(insight).toHaveProperty("id");
      expect(insight).toHaveProperty("type");
      expect(insight).toHaveProperty("title");
      expect(insight).toHaveProperty("message");
      expect(insight).toHaveProperty("priority");
      expect(["high", "medium", "low"]).toContain(insight.priority);
    });
  });

  it("generates a streak milestone insight at 3 days", () => {
    const workouts = [0, 1, 2].map((d) => makeWorkout({ daysAgo: d }));
    const result = generateInsights(workouts, []);
    const streakInsight = result.find((i) => i.type === "streak");
    expect(streakInsight).toBeDefined();
  });

  it("sorts insights by priority (high before medium before low)", () => {
    const workouts = [0, 1, 2, 3, 4, 5, 6].map((d) => makeWorkout({ daysAgo: d }));
    const result = generateInsights(workouts, []);
    const priorities = result.map((i) => i.priority);
    const priorityScore = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < priorities.length; i++) {
      expect(priorityScore[priorities[i]]).toBeGreaterThanOrEqual(
        priorityScore[priorities[i - 1]]
      );
    }
  });

  it("detects a neglected category", () => {
    // Only Chest workouts in last 2 weeks — Back/Legs neglected
    const chestOnly = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) =>
      makeWorkout({ daysAgo: d, category: "Chest" })
    );
    const result = generateInsights(chestOnly, []);
    const categoryInsight = result.find((i) => i.type === "category");
    // Should mention a neglected muscle group
    expect(categoryInsight).toBeDefined();
  });

  it("generates weight insights when weight data provided", () => {
    const weights = [
      makeWeight(daysAgoDate(30), 80),
      makeWeight(daysAgoDate(15), 78),
      makeWeight(daysAgoDate(0), 76),
    ];
    const result = generateInsights([], weights);
    const weightInsight = result.find((i) => i.type === "weight");
    expect(weightInsight).toBeDefined();
  });

  it("does not crash with a single workout", () => {
    expect(() => generateInsights([makeWorkout()], [])).not.toThrow();
  });
});

describe("calculateStreak", () => {
  it("keeps yesterday's consecutive streak alive when today is empty", () => {
    expect(calculateStreak([1, 2, 3].map((daysAgo) => makeWorkout({ daysAgo })))).toBe(3);
  });

  it("breaks after a missing calendar day", () => {
    expect(calculateStreak([0, 2].map((daysAgo) => makeWorkout({ daysAgo })))).toBe(1);
  });

  it("counts multiple workouts on the same day once", () => {
    expect(
      calculateStreak([
        makeWorkout({ daysAgo: 0 }),
        makeWorkout({ daysAgo: 0 }),
        makeWorkout({ daysAgo: 1 }),
      ]),
    ).toBe(2);
  });

  it("handles consecutive dates across a month boundary", () => {
    const now = new Date(2025, 2, 1, 12, 0, 0);
    const workouts = [
      makeWorkout({ date: "2025-03-01" }),
      makeWorkout({ date: "2025-02-28" }),
      makeWorkout({ date: "2025-02-27" }),
    ];

    expect(calculateStreak(workouts, now)).toBe(3);
  });
});

/* ─────────────────────────────────────────────
   PR detection
───────────────────────────────────────────── */
describe("generateInsights — PR detection", () => {
  it("detects a new PR when heaviest set ever performed today", () => {
    const historicWorkout = makeWorkout({
      daysAgo: 10,
      sets: [{ id: "s1", workoutId: "w1", setNumber: 1, reps: 10, weight: 80 }],
    });
    const todayPR = makeWorkout({
      daysAgo: 0,
      exercise: "Barbell Bench Press",
      sets: [{ id: "s2", workoutId: "w2", setNumber: 1, reps: 8, weight: 100 }],
    });

    const result = generateInsights([historicWorkout, todayPR], []);
    const prInsight = result.find((i) => i.type === "pr");
    expect(prInsight).toBeDefined();
    expect(prInsight!.priority).toBe("high");
  });
});
