import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";
import { workoutApi, type Workout } from "../services/api";
import { hidePendingDeletes, workoutKeys } from "../hooks/workoutCache";
import {
  __resetForTests,
  configureWorkoutDeleteQueue,
  flushWorkoutDeletes,
  readStoredDeletes,
  recoverWorkoutDeletes,
  scheduleWorkoutDelete,
  UNDO_WINDOW_MS,
  undoWorkoutDelete,
} from "../hooks/workoutDeleteQueue";
import { summarizeWorkouts } from "../hooks/useWorkoutSummary";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// useWorkoutSummary imports the React hook (and Firebase auth); only the pure summary is tested.
jest.mock("../hooks/useWorkouts", () => ({ useAllWorkouts: jest.fn() }));

const deleteMock = workoutApi.delete as jest.Mock;
const appStateListeners: ((s: string) => void)[] = [];
jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, fn: (s: string) => void) => {
  appStateListeners.push(fn);
  return { remove: () => {} };
}) as never);

const workout = (id: string, date: string, category: string, createdAt = `${date}T10:00:00.000Z`): Workout =>
  ({ id, userId: "u1", date, exercise: `${category} ex`, category, notes: null, sets: [], createdAt, updatedAt: createdAt }) as Workout;

/** What every screen sees: the shared list through its `select`. */
const visible = (qc: QueryClient) => hidePendingDeletes(qc.getQueryData<Workout[]>(workoutKeys.list()) ?? []).map((w) => w.id);

let qc: QueryClient;
let onFailure: jest.Mock;

beforeEach(async () => {
  jest.useFakeTimers();
  __resetForTests();
  appStateListeners.length = 0;
  await AsyncStorage.clear();
  deleteMock.mockReset();
  deleteMock.mockResolvedValue({ message: "ok", newlyUnlocked: [] });
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(workoutKeys.list(), [
    workout("shoulders", "2026-10-11", "Shoulders"),
    workout("legs", "2026-10-10", "Legs"),
    workout("chest", "2026-10-12", "Chest"),
  ]);
  onFailure = jest.fn();
  configureWorkoutDeleteQueue(qc, onFailure);
});

afterEach(() => {
  qc.clear();
  jest.useRealTimers();
});

test("hidden at once; DELETE fires once after the undo window with no screen mounted", async () => {
  scheduleWorkoutDelete(qc, "shoulders");
  expect(visible(qc)).toEqual(["legs", "chest"]);
  expect(await readStoredDeletes()).toEqual(["shoulders"]);

  await jest.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 1);
  expect(deleteMock).not.toHaveBeenCalled();

  await jest.advanceTimersByTimeAsync(1);
  expect(deleteMock).toHaveBeenCalledTimes(1);
  expect(deleteMock).toHaveBeenCalledWith("shoulders");
  expect(qc.getQueryData<Workout[]>(workoutKeys.list())!.map((w) => w.id)).toEqual(["legs", "chest"]);
  expect(await readStoredDeletes()).toEqual([]);
});

test("Undo within the window restores it and sends nothing", async () => {
  scheduleWorkoutDelete(qc, "legs");
  await jest.advanceTimersByTimeAsync(2000);
  expect(undoWorkoutDelete(qc, "legs")).toBe(true);
  expect(visible(qc)).toEqual(["shoulders", "legs", "chest"]);

  await jest.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
  expect(deleteMock).not.toHaveBeenCalled();
  expect(await readStoredDeletes()).toEqual([]);
});

test("app backgrounded mid-window: DELETE sent immediately", async () => {
  scheduleWorkoutDelete(qc, "shoulders");
  await jest.advanceTimersByTimeAsync(1000);
  expect(appStateListeners.length).toBeGreaterThan(0);
  appStateListeners.forEach((fn) => fn("background"));
  await jest.advanceTimersByTimeAsync(0);
  expect(deleteMock).toHaveBeenCalledWith("shoulders");
  expect(undoWorkoutDelete(qc, "shoulders")).toBe(false);

  await jest.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
  expect(deleteMock).toHaveBeenCalledTimes(1);
});

test("app killed mid-window: next launch re-hides and sends the stored delete", async () => {
  scheduleWorkoutDelete(qc, "shoulders");
  scheduleWorkoutDelete(qc, "legs");
  await jest.advanceTimersByTimeAsync(1000);
  expect(await readStoredDeletes()).toEqual(["shoulders", "legs"]);

  // Kill: timers and memory are gone, AsyncStorage survives.
  __resetForTests();
  expect(deleteMock).not.toHaveBeenCalled();

  const relaunched = new QueryClient();
  relaunched.setQueryData(workoutKeys.list(), qc.getQueryData(workoutKeys.list())); // persisted cache
  await recoverWorkoutDeletes(relaunched);
  expect(deleteMock.mock.calls.map((c) => c[0]).sort()).toEqual(["legs", "shoulders"]);
  expect(relaunched.getQueryData<Workout[]>(workoutKeys.list())!.map((w) => w.id)).toEqual(["chest"]);
  expect(await readStoredDeletes()).toEqual([]);
  relaunched.clear();
});

test("flushWorkoutDeletes sends every pending delete now", async () => {
  scheduleWorkoutDelete(qc, "shoulders");
  scheduleWorkoutDelete(qc, "legs");
  await flushWorkoutDeletes();
  expect(deleteMock).toHaveBeenCalledTimes(2);
});

test("404 is treated as already deleted", async () => {
  deleteMock.mockRejectedValueOnce(Object.assign(new Error("Not found"), { status: 404 }));
  scheduleWorkoutDelete(qc, "legs");
  await jest.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
  expect(visible(qc)).toEqual(["shoulders", "chest"]);
  expect(onFailure).not.toHaveBeenCalled();
});

test("other failures restore the workout and report it", async () => {
  deleteMock.mockRejectedValueOnce(Object.assign(new Error("Server error"), { status: 500 }));
  scheduleWorkoutDelete(qc, "legs");
  await jest.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
  expect(visible(qc)).toEqual(["shoulders", "legs", "chest"]);
  expect(onFailure).toHaveBeenCalledWith("legs", expect.any(Error));
  expect(await readStoredDeletes()).toEqual([]);
});

test("delete all, then log one Chest workout: Home shows one session, Session 1", async () => {
  scheduleWorkoutDelete(qc, "shoulders");
  scheduleWorkoutDelete(qc, "legs");
  scheduleWorkoutDelete(qc, "chest");
  await jest.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
  expect(deleteMock).toHaveBeenCalledTimes(3);

  // The server now returns only the new workout.
  qc.setQueryData(workoutKeys.list(), [workout("new-chest", "2026-10-12", "Chest")]);
  const summary = summarizeWorkouts(hidePendingDeletes(qc.getQueryData<Workout[]>(workoutKeys.list())!), 4, "2026-10-12");
  expect(summary.recent.map((s) => s.mainCategory)).toEqual(["Chest"]);
  expect(summary.sessions).toHaveLength(1);
  expect(summary.todaySession?.number).toBe(1);
});
