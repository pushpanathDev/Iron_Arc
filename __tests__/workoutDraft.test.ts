import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  __resetDraftForTests,
  activeSetOf,
  addExercises,
  addSet,
  beginDraft,
  clearDraft,
  completeSet,
  createDraft,
  deleteSet,
  draftName,
  extendRest,
  getDraft,
  insertSet,
  loadDraft,
  moveExercise,
  removeExercise,
  startEditSet,
  startRest,
  updateDraft,
  updateSet,
} from "../hooks/workoutDraft";
import type { Workout } from "../services/api";
import { buildExerciseIndex, checkPR, hadRecentPR, lastBestSet, recentExercises } from "../utils/exerciseHistory";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

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

describe("session draft", () => {
  const base = () => addExercises(createDraft("u1", "kg", 0), [{ name: "Bench Press", category: "Chest", plannedSets: 3 }, { name: "Dips", category: "Arms" }], (n) => (n === "Bench Press" ? { weight: 80, reps: 8 } : null));

  test("adds exercises with planned empty rows; first set prefilled from last time", () => {
    const d = base();
    expect(d.exercises.map((e) => e.sets.length)).toEqual([3, 1]);
    expect(d.exercises[0].sets[0]).toMatchObject({ weight: 80, reps: 8, done: false });
    expect(d.exercises[0].sets[1]).toMatchObject({ weight: null, reps: null });
    expect(d.activeKey).toBe(d.exercises[0].key);
    expect(addExercises(d, [{ name: "bench press", category: "Chest" }]).exercises).toHaveLength(2); // no duplicates
  });

  test("complete prefills the next planned row; completing the last row adds a new one", () => {
    let d = base();
    const ex = d.exercises[0];
    d = completeSet(d, ex.key, ex.sets[0].id);
    expect(d.exercises[0].sets[1]).toMatchObject({ weight: 80, reps: 8, done: false });
    d = completeSet(d, ex.key, d.exercises[0].sets[1].id);
    d = updateSet(d, ex.key, d.exercises[0].sets[2].id, { weight: 82.5 });
    d = completeSet(d, ex.key, d.exercises[0].sets[2].id);
    expect(d.exercises[0].sets).toHaveLength(4);
    expect(d.exercises[0].sets[3]).toMatchObject({ weight: 82.5, reps: 8, done: false });
    expect(activeSetOf(d.exercises[0], d.editingSetId)?.id).toBe(d.exercises[0].sets[3].id);
  });

  test("edit a completed set, delete and undo, add set", () => {
    let d = base();
    const key = d.exercises[0].key;
    const first = d.exercises[0].sets[0].id;
    d = completeSet(d, key, first);
    d = startEditSet(d, key, first);
    expect(activeSetOf(d.exercises[0], d.editingSetId)?.id).toBe(first);
    d = updateSet(d, key, first, { reps: 10 });
    d = completeSet(d, key, first); // save edit: no new row
    expect(d.editingSetId).toBeNull();
    expect(d.exercises[0].sets).toHaveLength(3);
    const removed = d.exercises[0].sets[0];
    d = deleteSet(d, key, removed.id);
    expect(d.exercises[0].sets).toHaveLength(2);
    d = insertSet(d, key, removed, 0);
    expect(d.exercises[0].sets[0]).toEqual(removed);
    d = addSet(d, key);
    expect(d.exercises[0].sets).toHaveLength(4);
  });

  test("move and remove exercises; name and rest", () => {
    let d = base();
    const [a, b] = d.exercises.map((e) => e.key);
    d = moveExercise(d, b, -1);
    expect(d.exercises.map((e) => e.key)).toEqual([b, a]);
    expect(draftName(d)).toBe("Arms & Chest");
    d = removeExercise(d, a);
    expect(d.activeKey).toBe(b);
    d = startRest(d, 90, 1000);
    expect(d.rest).toEqual({ endsAt: 91_000, duration: 90 });
    d = extendRest(d, 15, 2000);
    expect(d.rest?.endsAt).toBe(106_000);
  });

  test("auto-saves 500 ms after a change and restores after a restart", async () => {
    jest.useFakeTimers();
    await AsyncStorage.clear();
    __resetDraftForTests();
    beginDraft(createDraft("u1", "kg"));
    updateDraft((d) => addExercises(d, [{ name: "Squat", category: "Legs" }]));
    await jest.advanceTimersByTimeAsync(499);
    let saved = JSON.parse((await AsyncStorage.getItem("@log_session:u1"))!);
    expect(saved.exercises).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(1);
    saved = JSON.parse((await AsyncStorage.getItem("@log_session:u1"))!);
    expect(saved.exercises[0].name).toBe("Squat");

    __resetDraftForTests(); // "kill"
    expect(getDraft()).toBeNull();
    expect((await loadDraft("u1"))?.exercises[0].name).toBe("Squat");
    expect(await loadDraft("someone-else")).toBeNull();

    await clearDraft("u1");
    expect(await AsyncStorage.getItem("@log_session:u1")).toBeNull();
    jest.useRealTimers();
  });
});

describe("exercise history and PRs", () => {
  const history = [
    w("1", "2026-09-01", "Bench Press", [[70, 8], [75, 8]]),
    w("2", "2026-09-20", "Bench Press", [[80, 8], [80, 6]]),
    w("3", "2026-10-01", "Squat", [[100, 5]], "Legs"),
  ];
  const index = buildExerciseIndex(history);

  test("last best set and recent order", () => {
    expect(lastBestSet(index.get("bench press"))).toEqual({ weight: 80, reps: 8 });
    expect(recentExercises(index).map((h) => h.name)).toEqual(["Squat", "Bench Press"]);
  });

  test("PR: beats the heaviest weight at the same or more reps", () => {
    const prior = index.get("bench press")!.sessions.flatMap((s) => s.sets);
    expect(checkPR(prior, { weight: 82.5, reps: 8 })).toEqual({ isPR: true, previous: { weight: 80, reps: 8 }, kind: "weight" });
    expect(checkPR(prior, { weight: 80, reps: 8 }).isPR).toBe(false); // equal is not a PR
    expect(checkPR(prior, { weight: 0, reps: 20 }).isPR).toBe(false); // bodyweight
    expect(checkPR([], { weight: 100, reps: 5 }).isPR).toBe(false); // first-ever session
  });

  test("PR: more reps, or heavier and more reps, count too", () => {
    const prior = index.get("bench press")!.sessions.flatMap((s) => s.sets);
    // Heavier with more reps than ever (used to be missed: nothing earlier at ≥10 reps).
    expect(checkPR(prior, { weight: 85, reps: 10 })).toMatchObject({ isPR: true, kind: "weight" });
    // Same weight, more reps.
    expect(checkPR(prior, { weight: 80, reps: 10 })).toEqual({ isPR: true, previous: { weight: 80, reps: 8 }, kind: "reps" });
    // Lighter but much stronger overall (estimated 1RM).
    expect(checkPR([{ weight: 100, reps: 3 }], { weight: 90, reps: 8 })).toMatchObject({ isPR: true, kind: "strength" });
    // A light warm-up with many reps is not a record.
    expect(checkPR(prior, { weight: 40, reps: 20 }).isPR).toBe(false);
  });

  test("recent PR badge looks back 30 days", () => {
    expect(hadRecentPR(index.get("bench press"), "2026-10-12")).toBe(true); // 80×8 on 20 Sep beat 75×8
    expect(hadRecentPR(index.get("bench press"), "2026-11-30")).toBe(false);
    expect(hadRecentPR(index.get("squat"), "2026-10-12")).toBe(false); // single session
  });
});

describe("focus layout rules", () => {
  // Last time: set 1 = 60×10, set 2 = 62.5×8 (session unit).
  const lastTime = (name: string, i: number) => (name === "Squat" ? [{ weight: 60, reps: 10 }, { weight: 62.5, reps: 8 }][i] ?? null : null);

  test("prefill: last time's same set first, else the previous set in this session", () => {
    let d = addExercises(createDraft("u1", "kg", 0), [{ name: "Squat", category: "Legs" }], lastTime);
    const key = d.exercises[0].key;
    expect(d.exercises[0].sets[0]).toMatchObject({ weight: 60, reps: 10 });
    d = updateSet(d, key, d.exercises[0].sets[0].id, { weight: 70 });
    d = completeSet(d, key, d.exercises[0].sets[0].id, lastTime);
    expect(d.exercises[0].sets[1]).toMatchObject({ weight: 62.5, reps: 8 }); // last time had set 2
    d = completeSet(d, key, d.exercises[0].sets[1].id, lastTime);
    expect(d.exercises[0].sets[2]).toMatchObject({ weight: 62.5, reps: 8 }); // no set 3 last time → previous set
    d = addSet(d, key, lastTime);
    expect(d.exercises[0].sets[3]).toMatchObject({ weight: 62.5, reps: 8 });
  });

  test("adding from the session makes the new exercise active; others keep their sets", () => {
    let d = addExercises(createDraft("u1", "kg", 0), [{ name: "Squat", category: "Legs" }]);
    const first = d.exercises[0];
    d = completeSet(updateSet(d, first.key, first.sets[0].id, { weight: 100, reps: 5 }), first.key, first.sets[0].id);
    d = addExercises(d, [{ name: "Leg Press", category: "Legs" }], () => null, { activate: true });
    expect(d.activeKey).toBe(d.exercises[1].key);
    expect(d.exercises[0].sets[0]).toMatchObject({ weight: 100, reps: 5, done: true });
    // Add set goes to the active exercise.
    d = addSet(d, d.activeKey!);
    expect(d.exercises[1].sets).toHaveLength(2);
    expect(d.exercises[0].sets).toHaveLength(2);
  });

  test("removing the in-progress set renumbers; done chip rules", () => {
    let d = addExercises(createDraft("u1", "kg", 0), [{ name: "Row", category: "Back", plannedSets: 2 }]);
    const key = d.exercises[0].key;
    d = addSet(d, key);
    expect(d.exercises[0].sets).toHaveLength(3);
    d = deleteSet(d, key, d.exercises[0].sets[1].id);
    expect(d.exercises[0].sets).toHaveLength(2);
    const { isExerciseDone } = jest.requireActual("../hooks/workoutDraft");
    expect(isExerciseDone(d.exercises[0], true)).toBe(false);
    d = completeSet(updateSet(d, key, d.exercises[0].sets[0].id, { weight: 50, reps: 10 }), key, d.exercises[0].sets[0].id);
    d = completeSet(updateSet(d, key, d.exercises[0].sets[1].id, { weight: 50, reps: 10 }), key, d.exercises[0].sets[1].id);
    expect(isExerciseDone(d.exercises[0], true)).toBe(true); // planned 2, done 2
  });
});

describe("precomputed summaries", () => {
  const { buildExerciseSummaries, prWithin, lastTimeText, formatWeightValue } = jest.requireActual("../utils/exerciseHistory");
  const index = buildExerciseIndex([
    w("1", "2026-09-01", "Bench Press", [[70, 8], [75, 8]]),
    w("2", "2026-09-20", "Bench Press", [[80, 8], [80, 6]]),
    w("3", "2026-10-10", "Bench Press", [[20, 15], [20, 15], [15, 15]]),
  ]);
  const summaries = buildExerciseSummaries(index);

  test("match the per-row scans they replace", () => {
    const s = summaries.get("bench press");
    expect(s.lastSetCount).toBe(3);
    expect(s.lastBest).toEqual({ weight: 20, reps: 15 });
    expect(prWithin(s, "2026-10-12")).toBe(hadRecentPR(index.get("bench press"), "2026-10-12"));
    expect(prWithin(s, "2026-11-30")).toBe(hadRecentPR(index.get("bench press"), "2026-11-30"));
  });

  test("subtitle and number formatting", () => {
    expect(lastTimeText(summaries.get("bench press"), "kg")).toMatch(/^Last time: 3 sets · best 20 kg × 15 · /);
    expect(lastTimeText(undefined, "kg")).toBe("First time logging this");
    expect([formatWeightValue(15), formatWeightValue(82.5), formatWeightValue(80.0)]).toEqual(["15", "82.5", "80"]);
  });
});

describe("backdated logging: history as of the chosen date", () => {
  const H = jest.requireActual("../utils/exerciseHistory");
  const history = [
    w("1", "2026-10-05", "Deadlift", [[60, 12]], "Full Body"),
    w("2", "2026-10-13", "Deadlift", [[72.5, 15]], "Full Body"), // logged first, the newer day
  ];
  const index = H.buildExerciseIndex(history);
  const summaries = H.buildExerciseSummaries(index);

  test("logging for the 12th: last time is the 5th, not the 13th", () => {
    const asOf = H.indexAsOf(index, summaries, "2026-10-12");
    expect(H.lastBestSet(asOf.index.get("deadlift"))).toEqual({ weight: 60, reps: 12 });
    expect(asOf.summaries.get("deadlift").lastDate).toBe("2026-10-05");
  });

  test("a record on the 12th is judged against before the 12th only", () => {
    const prior = H.indexAsOf(index, summaries, "2026-10-12").index.get("deadlift").sessions.flatMap((s: { sets: unknown[] }) => s.sets);
    expect(H.checkPR(prior, { weight: 65, reps: 12 }).isPR).toBe(true); // beats 60 × 12
  });

  test("today (no date) or nothing later: the full index, unchanged", () => {
    expect(H.indexAsOf(index, summaries, null).index).toBe(index);
    expect(H.indexAsOf(index, summaries, "2026-10-14").index).toBe(index);
  });
});
