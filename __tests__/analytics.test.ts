import type { Workout } from "../services/api";
import { analyzePeriod, bestLifts, periodRange } from "../utils/analytics";
import { buildExerciseIndex } from "../utils/exerciseHistory";

// utils/analytics uses groupSessions from the hook module; only pure code is tested.
jest.mock("../hooks/useWorkouts", () => ({ useAllWorkouts: jest.fn() }));

const w = (id: string, date: string, exercise: string, sets: [number, number][], category = "Chest", time = "10:00"): Workout =>
  ({
    id,
    userId: "u",
    date,
    exercise,
    category,
    notes: null,
    createdAt: `${date}T${time}:00.000Z`,
    updatedAt: `${date}T${time}:00.000Z`,
    sets: sets.map(([weight, reps], i) => ({ id: `${id}-${i}`, workoutId: id, setNumber: i + 1, weight, reps })),
  }) as Workout;

// Wednesday 14 Oct 2026; the week runs Mon 12 – Sun 18.
const TODAY = "2026-10-14";

describe("period ranges", () => {
  test("week is Monday to Sunday of this week", () => {
    expect(periodRange("week", TODAY, null)).toEqual({ start: "2026-10-12", end: "2026-10-18" });
  });
  test("month is the calendar month", () => {
    expect(periodRange("month", TODAY, null)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
  });
  test("3 months is 13 whole weeks ending this week", () => {
    expect(periodRange("quarter", TODAY, null)).toEqual({ start: "2026-07-20", end: "2026-10-18" });
  });
  test("all starts at the first workout", () => {
    expect(periodRange("all", TODAY, "2025-03-02")).toEqual({ start: "2025-03-02", end: TODAY });
    expect(periodRange("all", TODAY, null)).toEqual({ start: TODAY, end: TODAY });
  });
});

describe("analyzePeriod", () => {
  const history = [
    w("a", "2026-10-05", "Bench Press", [[80, 8], [80, 8]]), // last Monday
    w("b", "2026-10-12", "Bench Press", [[85, 8], [85, 8], [85, 6]]), // this Monday
    w("c", "2026-10-12", "Row", [[60, 10]], "Back", "10:20"), // same session
    w("d", "2026-10-12", "Barbell Curl", [[15, 12]], "Arms", "18:00"), // 8 h later: second session
    w("e", "2026-10-14", "Squat", [[100, 5], [100, 5]], "Legs"),
  ];
  const week = analyzePeriod(history, "week", TODAY);

  test("counts sessions (3-hour gap), sets, volume and days in the period only", () => {
    expect(week.sessions).toBe(3);
    expect(week.sets).toBe(7);
    expect(week.volumeKg).toBe(85 * 8 * 2 + 85 * 6 + 600 + 180 + 1000);
    expect(week.trainingDays).toBe(2);
  });

  test("one bar per day; today current, later days future", () => {
    expect(week.bucketUnit).toBe("day");
    expect(week.buckets.map((b) => b.sets)).toEqual([5, 0, 2, 0, 0, 0, 0]);
    expect(week.buckets.map((b) => b.current)).toEqual([false, false, true, false, false, false, false]);
    expect(week.buckets.map((b) => b.future)).toEqual([false, false, false, true, true, true, true]);
    expect(week.buckets[0].day).toBe("2026-10-12");
  });

  test("compares volume with the same days last week (Mon–Wed)", () => {
    const thisKg = week.volumeKg;
    expect(week.compare).toEqual({ against: "last week", volumePct: Math.round(((thisKg - 1280) / 1280) * 100) });
  });

  test("no comparison number when the earlier span is empty", () => {
    expect(analyzePeriod([w("x", TODAY, "Bench Press", [[50, 5]])], "week", TODAY).compare?.volumePct).toBeNull();
  });

  test("muscle balance lists the main groups, arms split by exercise, busiest first, with shares of sets", () => {
    expect(week.balance.map((r) => [r.category, r.sets, r.share])).toEqual([
      ["Chest", 3, 43],
      ["Legs", 2, 29],
      ["Back", 1, 14],
      ["Biceps", 1, 14],
      ["Shoulders", 0, 0],
      ["Triceps", 0, 0],
      ["Forearms", 0, 0],
      ["Abs", 0, 0],
    ]);
  });

  test("arm work counts for biceps, triceps or forearms; an unknown arm exercise stays Arms", () => {
    const arms = [
      w("1", "2026-10-13", "Tricep Pushdown", [[20, 12], [20, 12]], "Arms"),
      w("2", "2026-10-13", "Hammer Curl", [[12, 10]], "Arms"),
      w("3", "2026-10-13", "Wrist Curl", [[10, 15]], "Arms"),
      w("4", "2026-10-13", "Mystery Arm Thing", [[10, 10]], "Arms"),
      w("5", "2026-10-13", "My Cable Curl", [[10, 10]], "Arms"),
    ];
    const custom = new Map([["my cable curl", "Biceps" as const]]);
    const sets = (stats: ReturnType<typeof analyzePeriod>, g: string) => stats.balance.find((r) => r.category === g)?.sets;
    const stats = analyzePeriod(arms, "week", TODAY, custom);
    expect([sets(stats, "Triceps"), sets(stats, "Biceps"), sets(stats, "Forearms"), sets(stats, "Arms")]).toEqual([2, 2, 1, 1]);
  });

  test("names untrained groups once there is enough to judge", () => {
    expect(week.leastTrained).toBeNull(); // 7 sets: too little to call
    const more = [...history, w("f", "2026-10-13", "Press", [[40, 8], [40, 8], [40, 8]], "Shoulders")];
    // Forearms aren't warned about: pulling and gripping train them.
    expect(analyzePeriod(more, "week", TODAY).leastTrained).toEqual({ categories: ["Triceps", "Abs"], untrained: true });
  });

  test("month buckets are weeks clipped to the month", () => {
    const month = analyzePeriod(history, "month", TODAY);
    expect(month.bucketUnit).toBe("week");
    expect(month.buckets.map((b) => b.key)).toEqual(["2026-10-01", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(month.buckets.map((b) => b.sets)).toEqual([0, 2, 7, 0, 0]);
    expect(month.sessions).toBe(4);
  });

  test("all time charts the last 12 months at most", () => {
    const all = analyzePeriod([w("old", "2024-01-10", "Bench Press", [[60, 5]]), ...history], "all", TODAY);
    expect(all.bucketUnit).toBe("month");
    expect(all.buckets).toHaveLength(12);
    expect(all.chartTruncated).toBe(true);
    expect(all.compare).toBeNull();
    expect(all.sessions).toBe(5);
  });
});

describe("bestLifts", () => {
  const history = [
    w("1", "2026-09-01", "Bench Press", [[90, 3]]),
    w("2", "2026-10-12", "Bench Press", [[85, 8]]), // stronger than 90 × 3 (estimated 1RM): a PR, not the heaviest
    w("2b", "2026-10-13", "Bench Press", [[80, 5]]), // weaker: no PR
    w("3", "2026-09-10", "Squat", [[100, 5]], "Legs"),
    w("4", "2026-10-13", "Squat", [[110, 5]], "Legs"), // PR this week, new best
    w("5", "2026-10-13", "Pull-up", [[0, 10]], "Back"), // bodyweight only: left out
    w("6", "2026-10-02", "Row", [[60, 10]], "Back"), // single session: no PR
  ];
  const lifts = bestLifts(buildExerciseIndex(history), "2026-10-12", TODAY);

  test("heaviest set per exercise, newest first, bodyweight left out", () => {
    expect(lifts.map((l) => [l.exercise, l.set.weight, l.set.reps, l.date])).toEqual([
      ["Squat", 110, 5, "2026-10-13"],
      ["Row", 60, 10, "2026-10-02"],
      ["Bench Press", 90, 3, "2026-09-01"], // heaviest stays 90 × 3
    ]);
  });

  test("star only for a real PR inside the period", () => {
    expect(Object.fromEntries(lifts.map((l) => [l.exercise, l.prInPeriod]))).toEqual({ Squat: true, Row: false, "Bench Press": true });
  });
});

describe("records, reach and headline", () => {
   
  const A = require("../utils/analytics");
   
  const { prEvents } = require("../utils/exerciseHistory");
  const history = [
    w("1", "2026-09-28", "Bench Press", [[80, 8], [80, 8]]),
    w("2", "2026-10-05", "Bench Press", [[80, 8]]),
    w("3", "2026-10-12", "Bench Press", [[80, 10]]), // rep PR this week
    w("4", "2026-10-01", "Squat", [[100, 5]], "Legs"),
    w("5", "2026-10-08", "Squat", [[100, 5]], "Legs"), // equal: no PR
  ];
  const index = buildExerciseIndex(history);
  const events = prEvents(index);

  test("PR events: one per exercise per session, with kind", () => {
    expect(events.map((e: { exercise: string; kind: string; date: string }) => [e.exercise, e.kind, e.date])).toEqual([["Bench Press", "reps", "2026-10-12"]]);
    expect(A.prsInRange(events, "2026-10-12", TODAY)).toHaveLength(1);
    expect(A.prsInRange(events, "2026-10-13", TODAY)).toHaveLength(0);
  });

  test("within reach: the smallest next set the PR rule would count", () => {
    const reach = A.withinReach(index, TODAY, 2.5);
    expect(reach.map((r: { exercise: string; target: unknown; kind: string }) => [r.exercise, r.target, r.kind])).toEqual([
      ["Bench Press", { weight: 80, reps: 11 }, "reps"],
      ["Squat", { weight: 100, reps: 6 }, "reps"],
    ]);
  });

  test("headline leads with new records", () => {
    const stats = analyzePeriod(history, "week", TODAY);
    const prs = A.prsInRange(events, stats.start, stats.end);
    expect(A.headlineFor(history, "week", stats, prs, TODAY, "this week", "kg")).toEqual({
      icon: "star",
      tone: "record",
      text: "1 new record this week: Bench Press",
      detail: "Bench Press +2 reps",
    });
  });

  test("weekly sets per muscle group use the weeks elapsed", () => {
    const stats = analyzePeriod(history, "month", TODAY); // 1–14 Oct: 2 weeks
    const rows = A.muscleWeeks(history, stats, TODAY);
    const chest = rows.find((r: { category: string }) => r.category === "Chest");
    expect(chest).toMatchObject({ sets: 2, perWeek: 1, status: "under", daysSince: 2 });
    expect(rows.find((r: { category: string }) => r.category === "Back").daysSince).toBeNull();
  });
});

describe("chart buckets", () => {
  const history = [
    w("a", "2026-10-12", "Bench Press", [[80, 8], [80, 8]]),
    w("b", "2026-10-12", "Curl", [[15, 12]], "Arms", "18:00"), // second session that day
    w("c", "2026-10-14", "Squat", [[100, 5]], "Legs"),
  ];

  test("each bar knows its workouts and days covered", () => {
    const week = analyzePeriod(history, "week", TODAY);
    expect(week.buckets.map((b) => b.sessions)).toEqual([2, 0, 1, 0, 0, 0, 0]);
    expect(week.buckets[0]).toMatchObject({ from: "2026-10-12", to: "2026-10-12" });
  });

  test("month bars are labelled as day ranges", () => {
    const month = analyzePeriod(history, "month", TODAY);
    expect(month.buckets.map((b) => b.label)).toEqual(["1–4", "5–11", "12–18", "19–25", "26–31"]);
  });

  test("all time shows at least six months", () => {
    const all = analyzePeriod(history, "all", TODAY);
    expect(all.buckets.map((b) => b.key)).toEqual(["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(all.buckets[5].sets).toBe(4);
  });
});

describe("exercisesByCategory", () => {
   
  const { exercisesByCategory } = require("../utils/analytics");
  test("sets per exercise within the period, busiest first", () => {
    const m = exercisesByCategory(
      [
        w("1", "2026-10-12", "Barbell Curl", [[15, 12], [15, 12]], "Arms"),
        w("2", "2026-10-13", "Dumbbell Curl", [[12, 12], [12, 12], [12, 10]], "Arms"),
        w("3", "2026-10-01", "Barbell Curl", [[15, 12]], "Arms"), // before the period
        w("4", "2026-10-13", "Tricep Pushdown", [[20, 12]], "Arms"),
      ],
      "2026-10-12",
      TODAY,
    );
    expect(m.get("Biceps")).toEqual([
      { exercise: "Dumbbell Curl", sets: 3 },
      { exercise: "Barbell Curl", sets: 2 },
    ]);
    expect(m.get("Triceps")).toEqual([{ exercise: "Tricep Pushdown", sets: 1 }]);
  });
});
