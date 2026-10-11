import {
  getStartOfWeek,
  calculateWeeklyReps,
  calculateWorkoutStreak,
} from "../utils/workoutStats";

/* ─────────────────────────────────────────────
   getStartOfWeek
───────────────────────────────────────────── */
describe("getStartOfWeek", () => {
  it("returns the Monday of the current week", () => {
    const wednesday = new Date("2026-06-24"); // Wednesday
    const result = getStartOfWeek(wednesday);
    expect(result.toISOString().startsWith("2026-06-22")).toBe(true); // Monday
  });

  it("returns Monday for a Sunday (ISO weeks: Sunday = end of week)", () => {
    const sunday = new Date("2026-06-28"); // Sunday
    const result = getStartOfWeek(sunday);
    expect(result.toISOString().startsWith("2026-06-22")).toBe(true); // Prev Monday
  });

  it("returns the same Monday when called on a Monday", () => {
    const monday = new Date("2026-06-22");
    const result = getStartOfWeek(monday);
    expect(result.toISOString().startsWith("2026-06-22")).toBe(true);
  });
});

/* ─────────────────────────────────────────────
   calculateWeeklyReps
───────────────────────────────────────────── */
describe("calculateWeeklyReps", () => {
  const now = new Date();
  const todayIso = now.toISOString();

  const oldDate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();

  const workouts = [
    {
      createdAt: todayIso,
      sets: [
        { reps: 10, weight: 80 },
        { reps: 12, weight: 75 },
      ],
    },
    {
      createdAt: todayIso,
      sets: [{ reps: 8, weight: 100 }],
    },
    {
      createdAt: oldDate, // outside current week
      sets: [{ reps: 50, weight: 50 }],
    },
  ];

  it("sums reps for workouts in the current week", () => {
    const result = calculateWeeklyReps(workouts);
    expect(result).toBe(30); // 10 + 12 + 8
  });

  it("ignores workouts older than the current week", () => {
    const onlyOld = [
      { createdAt: oldDate, sets: [{ reps: 100, weight: 50 }] },
    ];
    expect(calculateWeeklyReps(onlyOld)).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(calculateWeeklyReps([])).toBe(0);
  });

  it("handles missing sets gracefully", () => {
    const noSets = [{ createdAt: todayIso, sets: undefined }];
    expect(calculateWeeklyReps(noSets)).toBe(0);
  });
});

/* ─────────────────────────────────────────────
   calculateWorkoutStreak
───────────────────────────────────────────── */
describe("calculateWorkoutStreak", () => {
  function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }

  it("returns 0 for empty workout list", () => {
    expect(calculateWorkoutStreak([])).toBe(0);
  });

  it("returns 1 for a single workout today", () => {
    const workouts = [{ createdAt: daysAgo(0) }];
    expect(calculateWorkoutStreak(workouts)).toBe(1);
  });

  it("counts consecutive days", () => {
    const workouts = [
      { createdAt: daysAgo(0) },
      { createdAt: daysAgo(1) },
      { createdAt: daysAgo(2) },
    ];
    expect(calculateWorkoutStreak(workouts)).toBe(3);
  });

  it("stops counting at a gap", () => {
    const workouts = [
      { createdAt: daysAgo(0) },
      { createdAt: daysAgo(1) },
      { createdAt: daysAgo(3) }, // gap on day 2
    ];
    expect(calculateWorkoutStreak(workouts)).toBe(2);
  });

  it("handles duplicate same-day entries without inflating streak", () => {
    const workouts = [
      { createdAt: daysAgo(0) },
      { createdAt: daysAgo(0) }, // same day
      { createdAt: daysAgo(1) },
    ];
    expect(calculateWorkoutStreak(workouts)).toBe(2);
  });
});
