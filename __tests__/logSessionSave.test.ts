import { QueryClient } from "@tanstack/react-query";
import { workoutApi } from "../services/api";
import { __resetDraftForTests, addExercises, beginDraft, completeSet, createDraft, getDraft, updateDraft, updateSet } from "../hooks/logSession";
import { saveLogSession } from "../hooks/logSessionSave";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const createBatch = workoutApi.createBatch as jest.Mock;
const create = workoutApi.create as jest.Mock;
const listAll = workoutApi.listAll as jest.Mock;

function sessionWith(names: string[]) {
  __resetDraftForTests();
  beginDraft(createDraft("u1", "lbs", Date.parse("2026-10-12T09:00:00Z")));
  updateDraft((d) => addExercises(d, names.map((name) => ({ name, category: "Chest" }))));
  for (const ex of getDraft()!.exercises) {
    updateDraft((d) => updateSet(d, ex.key, ex.sets[0].id, { weight: 185, reps: 8 }));
    updateDraft((d) => completeSet(d, ex.key, ex.sets[0].id));
  }
}

beforeEach(() => {
  createBatch.mockReset();
  create.mockReset();
  listAll.mockReset().mockResolvedValue([]);
});

test("Finish with 3 exercises: ONE batch request with only completed sets, in kg", async () => {
  sessionWith(["Bench Press", "Dips", "Fly"]);
  createBatch.mockImplementation(async (body) => ({ data: body.entries.map((e: { exercise: string }, i: number) => ({ id: `w${i}`, ...e })), newlyUnlocked: ["first_workout"] }));
  const qc = new QueryClient();
  const res = await saveLogSession(qc);
  expect(res).toEqual({ saved: true, count: 3, newlyUnlocked: ["first_workout"] });
  expect(createBatch).toHaveBeenCalledTimes(1);
  expect(create).not.toHaveBeenCalled();
  const [body] = createBatch.mock.calls[0];
  expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(body.entries.map((e: { exercise: string }) => e.exercise)).toEqual(["Bench Press", "Dips", "Fly"]);
  expect(body.entries[0]).toEqual({ exercise: "Bench Press", category: "Chest", sets: [{ reps: 8, weight: 83.9 }] }); // 185 lbs; pending row not sent
  qc.clear();
});

test("failure (e.g. airplane mode): nothing saved, the session is kept", async () => {
  sessionWith(["Bench Press", "Dips", "Fly"]);
  createBatch.mockRejectedValueOnce(new Error("Network request failed"));
  const qc = new QueryClient();
  const res = await saveLogSession(qc);
  expect(res.saved).toBe(false);
  expect(res.error).toBeDefined();
  expect(getDraft()!.exercises).toHaveLength(3);
  expect(getDraft()!.exercises.every((e) => e.sets[0].done)).toBe(true);
  qc.clear();
});

test("retry after a lost response: adopts the committed batch instead of posting twice", async () => {
  sessionWith(["Bench Press", "Dips"]);
  createBatch.mockRejectedValueOnce(new Error("timeout"));
  const qc = new QueryClient();
  await saveLogSession(qc);
  // The timed-out request had actually committed on the server.
  const createdAt = new Date().toISOString();
  listAll.mockResolvedValue([
    { id: "w1", date: getDraft()!.date ?? new Date().toISOString().slice(0, 10), exercise: "Bench Press", createdAt, sets: [{}] },
    { id: "w2", date: getDraft()!.date ?? new Date().toISOString().slice(0, 10), exercise: "Dips", createdAt, sets: [{}] },
  ]);
  const res = await saveLogSession(qc);
  expect(res.saved).toBe(true);
  expect(createBatch).toHaveBeenCalledTimes(1); // only the first, failed attempt
  qc.clear();
});

test("retry when the first attempt never reached the server: posts again", async () => {
  sessionWith(["Bench Press"]);
  createBatch.mockRejectedValueOnce(new Error("Network request failed")).mockResolvedValueOnce({ data: [{ id: "w1" }], newlyUnlocked: [] });
  const qc = new QueryClient();
  await saveLogSession(qc);
  const res = await saveLogSession(qc);
  expect(res.saved).toBe(true);
  expect(createBatch).toHaveBeenCalledTimes(2);
  qc.clear();
});
