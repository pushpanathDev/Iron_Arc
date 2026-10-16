import type { Workout } from "../services/api";
import { buildExerciseIndex, recentPRs } from "../utils/exerciseHistory";
import { summarizeWorkouts } from "../hooks/useWorkoutSummary";

// useWorkoutSummary imports the React hook (and Firebase auth); only the pure summary is tested.
jest.mock("../hooks/useWorkouts", () => ({ useAllWorkouts: jest.fn() }));

const w = (id: string, date: string, exercise: string, sets: [number, number][], category = "Chest"): Workout =>
  ({
    id,
    userId: "u",
    date,
    exercise,
    category,
    notes: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`,
    sets: sets.map(([weight, reps], i) => ({ id: `${id}-${i}`, workoutId: id, setNumber: i + 1, weight, reps })),
  }) as Workout;

describe("PRs this week", () => {
  const history = [
    w("1", "2026-09-20", "Bench Press", [[80, 8]]),
    w("2", "2026-10-08", "Bench Press", [[82.5, 8], [85, 8]]), // two PRs in the window → heaviest kept
    w("3", "2026-10-01", "Squat", [[100, 5]], "Legs"),
    w("4", "2026-10-03", "Squat", [[110, 5]], "Legs"), // PR, but outside 7 days
    w("5", "2026-10-11", "Row", [[60, 10]], "Back"), // first-ever session: never a PR
  ];

  test("one per exercise, heaviest, within 7 days only", () => {
    const prs = recentPRs(buildExerciseIndex(history), "2026-10-12");
    expect(prs.map((p) => [p.exercise, p.set.weight, p.previous.weight])).toEqual([["Bench Press", 85, 80]]);
  });

  test("none when nothing beats an earlier lift", () => {
    expect(recentPRs(buildExerciseIndex([w("1", "2026-10-01", "Curl", [[20, 10]]), w("2", "2026-10-10", "Curl", [[20, 10]])]), "2026-10-12")).toEqual([]);
  });
});

describe("week volume vs the same days last week", () => {
  // Monday 2026-10-12 is the start of the week.
  test("compares Mon..today with the same span last week", () => {
    const s = summarizeWorkouts(
      [
        w("a", "2026-10-13", "Bench", [[100, 10]]), // this week (Tue): 1000
        w("b", "2026-10-06", "Bench", [[80, 10]]), // last week Tue: 800 (same span)
        w("c", "2026-10-09", "Bench", [[200, 10]]), // last week Fri: outside the span
      ],
      4,
      "2026-10-13",
    );
    expect(s.volume).toEqual({ thisWeekKg: 1000, lastWeekSameSpanKg: 800, changePct: 25 });
  });

  test("no comparison without last week's data", () => {
    const s = summarizeWorkouts([w("a", "2026-10-12", "Bench", [[100, 10]])], 4, "2026-10-12");
    expect(s.volume.changePct).toBeNull();
  });
});

describe("History helpers", () => {
   
  const { groupSessions } = require("../hooks/useWorkoutSummary");
   
  const { prExerciseDays } = require("../utils/exerciseHistory");
  const at = (id: string, date: string, time: string, exercise: string, sets: [number, number][]) =>
    ({ ...w(id, date, exercise, sets), createdAt: `${date}T${time}:00.000Z` }) as Workout;

  test("sessions: same day within 3 hours, split by a longer gap, newest first", () => {
    const groups = groupSessions([
      at("a", "2026-10-12", "07:00", "Bench", [[80, 8]]),
      at("b", "2026-10-12", "07:40", "Fly", [[14, 12]]),
      at("c", "2026-10-12", "18:00", "Squat", [[100, 5]]), // evening: a second session
      at("d", "2026-10-11", "09:00", "Row", [[60, 10]]),
    ]);
    expect(groups.map((g: { list: Workout[] }) => g.list.map((x) => x.id))).toEqual([["c"], ["a", "b"], ["d"]]);
  });

  test("PR days: only sessions that beat an earlier lift", () => {
    const days = prExerciseDays(
      buildExerciseIndex([
        w("1", "2026-10-01", "Bench Press", [[80, 8]]),
        w("2", "2026-10-05", "Bench Press", [[80, 8]]), // equal: not a PR
        w("3", "2026-10-09", "Bench Press", [[82.5, 8]]), // PR
        w("4", "2026-10-09", "Row", [[60, 10]]), // first time: never a PR
      ]),
    );
    expect([...days]).toEqual(["bench press|2026-10-09"]);
  });
});
