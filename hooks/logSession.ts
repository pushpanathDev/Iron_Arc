import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import type { WeightUnit } from "../utils/unitConversion";

/*
 * The in-progress Log Workout session. One draft per user, kept in memory
 * for the picker and session screens and saved to AsyncStorage (debounced
 * 500 ms, immediately when the app is backgrounded) so a kill or crash never
 * loses sets. The draft is cleared only after the server confirms the save.
 *
 * Weights in the draft are in the unit the session started in (`unit`);
 * they're converted to kg only when saving.
 */

export interface DraftSet {
  id: string;
  weight: number | null;
  reps: number | null;
  done: boolean;
}

export interface DraftExercise {
  key: string;
  name: string;
  category: string;
  /** Biceps / Triceps / Forearms for arm exercises (display only; saves as category). */
  subgroup?: string;
  sets: DraftSet[];
  /** From a plan, used for the rest timer. */
  restSeconds?: number;
  /** From a plan: the exercise counts as done once this many sets are. */
  plannedSets?: number;
  /** Optional note, saved with this exercise. */
  notes?: string;
}

export interface LogDraft {
  version: 1;
  userId: string;
  unit: WeightUnit;
  /** YYYY-MM-DD for a past date, null = today. */
  date: string | null;
  startedAt: number;
  exercises: DraftExercise[];
  activeKey: string | null;
  /** A completed set reopened for editing. */
  editingSetId: string | null;
  rest: { endsAt: number; duration: number } | null;
  /** Set when a save was first attempted; a retry first checks whether that save reached the server. */
  saveStartedAt?: number;
}

export interface NewExercise {
  name: string;
  category: string;
  subgroup?: string;
  /** Planned set count: that many empty rows. */
  plannedSets?: number;
  restSeconds?: number;
}

export type SetValues = { weight: number | null; reps: number | null };

/** The same set number from the most recent previous session ("last time"), in the session unit. */
export type LastTimeLookup = (exerciseName: string, setIndex: number) => SetValues | null;
const noLastTime: LastTimeLookup = () => null;

const STORAGE_PREFIX = "@log_session:";
const SAVE_DEBOUNCE_MS = 500;

let seq = 0;
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

/* =========================================================
   Pure updates (unit-tested)
   ========================================================= */

export function createDraft(userId: string, unit: WeightUnit, now = Date.now()): LogDraft {
  return { version: 1, userId, unit, date: null, startedAt: now, exercises: [], activeKey: null, editingSetId: null, rest: null };
}

const mapExercise = (d: LogDraft, key: string, fn: (e: DraftExercise) => DraftExercise): LogDraft => ({
  ...d,
  exercises: d.exercises.map((e) => (e.key === key ? fn(e) : e)),
});

const emptySet = (values: SetValues | null = null): DraftSet => ({
  id: newId("s"),
  weight: values?.weight ?? null,
  reps: values?.reps ?? null,
  done: false,
});

/** The set the active card edits: the reopened one, else the first not done. */
export function activeSetOf(ex: DraftExercise, editingSetId: string | null): DraftSet | null {
  return ex.sets.find((s) => s.id === editingSetId) ?? ex.sets.find((s) => !s.done) ?? null;
}

export const doneSets = (ex: DraftExercise) => ex.sets.filter((s) => s.done);

/**
 * Adds exercises (duplicates by name are skipped). Planned sets become empty
 * rows; the first row is prefilled from last time. With `activate`, the
 * first added exercise becomes the active one (adding from the session).
 */
export function addExercises(
  d: LogDraft,
  items: NewExercise[],
  lastTime: LastTimeLookup = noLastTime,
  options: { activate?: boolean } = {},
): LogDraft {
  const have = new Set(d.exercises.map((e) => e.name.toLowerCase()));
  const added: DraftExercise[] = [];
  for (const item of items) {
    if (have.has(item.name.toLowerCase())) continue;
    have.add(item.name.toLowerCase());
    const count = Math.max(1, item.plannedSets ?? 1);
    const sets = Array.from({ length: count }, (_, i) => emptySet(i === 0 ? lastTime(item.name, 0) : null));
    added.push({
      key: newId("e"),
      name: item.name,
      category: item.category,
      subgroup: item.subgroup,
      sets,
      restSeconds: item.restSeconds,
      plannedSets: item.plannedSets,
    });
  }
  if (!added.length) return d;
  const activeKey = options.activate || !d.activeKey ? added[0].key : d.activeKey;
  return { ...d, exercises: [...d.exercises, ...added], activeKey, editingSetId: activeKey === d.activeKey ? d.editingSetId : null };
}

export function removeExercise(d: LogDraft, key: string): LogDraft {
  const index = d.exercises.findIndex((e) => e.key === key);
  if (index < 0) return d;
  const exercises = d.exercises.filter((e) => e.key !== key);
  const activeKey = d.activeKey === key ? (exercises[Math.min(index, exercises.length - 1)]?.key ?? null) : d.activeKey;
  return { ...d, exercises, activeKey, editingSetId: d.activeKey === key ? null : d.editingSetId };
}

/** Undo for removeExercise. */
export function insertExercise(d: LogDraft, ex: DraftExercise, index: number): LogDraft {
  if (d.exercises.some((e) => e.key === ex.key)) return d;
  const exercises = [...d.exercises];
  exercises.splice(Math.min(index, exercises.length), 0, ex);
  return { ...d, exercises, activeKey: d.activeKey ?? ex.key };
}

export function moveExercise(d: LogDraft, key: string, direction: -1 | 1): LogDraft {
  const i = d.exercises.findIndex((e) => e.key === key);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= d.exercises.length) return d;
  const exercises = [...d.exercises];
  [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
  return { ...d, exercises };
}

export function setActiveExercise(d: LogDraft, key: string): LogDraft {
  return d.activeKey === key ? d : { ...d, activeKey: key, editingSetId: null };
}

export function updateSet(d: LogDraft, exKey: string, setId: string, values: Partial<SetValues>): LogDraft {
  return mapExercise(d, exKey, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...values } : s)) }));
}

/**
 * Values for the set at `index`: last time's same set if there is one, else
 * the previous set in this session, else empty.
 */
function prefillFor(ex: DraftExercise, sets: DraftSet[], index: number, lastTime: LastTimeLookup): SetValues | null {
  const fromLastTime = lastTime(ex.name, index);
  if (fromLastTime) return fromLastTime;
  const prev = sets[index - 1];
  return prev ? { weight: prev.weight, reps: prev.reps } : null;
}

/**
 * Marks a set done. When it was a new set (not an edit), the next set is
 * prepared with the prefill rule: the next planned row if it's still empty,
 * otherwise a new row.
 */
export function completeSet(d: LogDraft, exKey: string, setId: string, lastTime: LastTimeLookup = noLastTime): LogDraft {
  const editing = d.editingSetId === setId;
  let next = mapExercise(d, exKey, (e) => {
    const sets = e.sets.map((s) => (s.id === setId ? { ...s, done: true } : s));
    if (editing) return { ...e, sets };
    const pendingIndex = sets.findIndex((s) => !s.done);
    if (pendingIndex >= 0) {
      const pending = sets[pendingIndex];
      if (pending.weight == null && pending.reps == null) sets[pendingIndex] = { ...pending, ...prefillFor(e, sets, pendingIndex, lastTime) };
      return { ...e, sets };
    }
    return { ...e, sets: [...sets, emptySet(prefillFor(e, sets, sets.length, lastTime))] };
  });
  if (editing) next = { ...next, editingSetId: null };
  return next;
}

export function startEditSet(d: LogDraft, exKey: string, setId: string): LogDraft {
  return { ...d, activeKey: exKey, editingSetId: setId };
}

export function cancelEdit(d: LogDraft): LogDraft {
  return d.editingSetId ? { ...d, editingSetId: null } : d;
}

/** Adds a row to the exercise, prefilled by the same rule as completing a set. */
export function addSet(d: LogDraft, exKey: string, lastTime: LastTimeLookup = noLastTime): LogDraft {
  return mapExercise(d, exKey, (e) => ({ ...e, sets: [...e.sets, emptySet(prefillFor(e, e.sets, e.sets.length, lastTime))] }));
}

export function deleteSet(d: LogDraft, exKey: string, setId: string): LogDraft {
  const next = mapExercise(d, exKey, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) }));
  return d.editingSetId === setId ? { ...next, editingSetId: null } : next;
}

export function insertSet(d: LogDraft, exKey: string, set: DraftSet, index: number): LogDraft {
  return mapExercise(d, exKey, (e) => {
    if (e.sets.some((s) => s.id === set.id)) return e;
    const sets = [...e.sets];
    sets.splice(Math.min(index, sets.length), 0, set);
    return { ...e, sets };
  });
}

/** Optional per-exercise note (saved with the workout). */
export function setExerciseNotes(d: LogDraft, exKey: string, notes: string): LogDraft {
  return mapExercise(d, exKey, (e) => ({ ...e, notes }));
}

export function setDate(d: LogDraft, date: string | null): LogDraft {
  return { ...d, date };
}

export function startRest(d: LogDraft, seconds: number, now = Date.now()): LogDraft {
  return { ...d, rest: { endsAt: now + seconds * 1000, duration: seconds } };
}

export function extendRest(d: LogDraft, seconds: number, now = Date.now()): LogDraft {
  if (!d.rest) return d;
  return { ...d, rest: { endsAt: Math.max(d.rest.endsAt, now) + seconds * 1000, duration: d.rest.duration + seconds } };
}

export function clearRest(d: LogDraft): LogDraft {
  return d.rest ? { ...d, rest: null } : d;
}

/** Done = all planned sets completed; without a plan, any completed set once you've moved on. */
export function isExerciseDone(ex: DraftExercise, active: boolean): boolean {
  const done = ex.sets.filter((s) => s.done).length;
  if (ex.plannedSets) return done >= ex.plannedSets;
  return done > 0 && !active;
}

export const hasDoneSets = (d: LogDraft | null) => !!d?.exercises.some((e) => e.sets.some((s) => s.done));

/** "Chest & Arms" (the app's existing session naming), from the added exercises. */
export function draftName(d: LogDraft): string {
  const categories = [...new Set(d.exercises.map((e) => e.category).filter((c) => c && c !== "Other"))];
  if (categories.length === 0) return "Workout";
  if (categories.length <= 2) return categories.map(displayCategory).join(" & ");
  return "Mixed session";
}

/** The catalog stores Core as "Abs". */
export const displayCategory = (category: string) => (category === "Abs" ? "Core" : category);

/* =========================================================
   Store + persistence
   ========================================================= */

let draft: LogDraft | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const storageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;
const emit = () => listeners.forEach((l) => l());

/** Write the draft to storage now (e.g. right after the server confirms part of a save). */
export async function writeNow() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const d = draft;
  if (!d) return;
  try {
    await AsyncStorage.setItem(storageKey(d.userId), JSON.stringify(d));
  } catch {
    // Storage full or unavailable: the in-memory session keeps working.
  }
}

AppState.addEventListener("change", (s) => {
  if (s !== "active") void writeNow();
});

export const getDraft = () => draft;

/** Apply an update; saved to storage 500 ms after the last change. */
export function updateDraft(fn: (d: LogDraft) => LogDraft) {
  if (!draft) return;
  const next = fn(draft);
  if (next === draft) return;
  draft = next;
  emit();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void writeNow(), SAVE_DEBOUNCE_MS);
}

/** Start (or replace) the session in memory and save it right away. */
export function beginDraft(next: LogDraft) {
  draft = next;
  emit();
  void writeNow();
}

/** The saved session for this user, if any (also loads it into memory). */
export async function loadDraft(userId: string): Promise<LogDraft | null> {
  if (draft?.userId === userId) return draft;
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    const parsed = raw ? (JSON.parse(raw) as LogDraft) : null;
    if (parsed?.version === 1 && parsed.userId === userId) {
      draft = parsed;
      emit();
      return parsed;
    }
  } catch {
    // Unreadable draft: treat as none.
  }
  return null;
}

/** Remove the session (discard, or after the server confirmed the save). */
export async function clearDraft(userId?: string) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const id = userId ?? draft?.userId;
  draft = null;
  emit();
  if (id) await AsyncStorage.removeItem(storageKey(id)).catch(() => {});
}

export function useLogDraft(): LogDraft | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => draft,
  );
}

/** Test helper. */
export function __resetDraftForTests() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  draft = null;
  listeners.clear();
}
