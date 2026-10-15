/**
 * Log picker / session JS cost benchmark (not part of the normal suite).
 *   npx jest --testMatch "**\/__tests__/perf/*.perf.tsx" --verbose=false
 * Synthetic history: 18 months, 4 sessions a week, 5 exercises a session.
 * Measures JS work only (React render/reconcile + data); native layout and
 * drawing on the device come on top of this.
 */
 
const { act, create } = require("react-test-renderer");
import type { Workout } from "../../services/api";

jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-haptics", () => ({ impactAsync: async () => {}, selectionAsync: async () => {}, notificationAsync: async () => {}, ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));

const CATEGORIES = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Abs"];
const NAMES = CATEGORIES.flatMap((c) => Array.from({ length: 6 }, (_, i) => ({ name: `${c} Exercise ${i + 1}`, category: c })));

function syntheticHistory(): Workout[] {
  const out: Workout[] = [];
  const start = Date.parse("2025-04-01T00:00:00Z");
  let n = 0;
  for (let day = 0; day < 545; day++) {
    if (day % 7 === 1 || day % 7 === 3 || day % 7 === 5 || day % 7 === 6) {
      const date = new Date(start + day * 86_400_000).toISOString().slice(0, 10);
      for (let e = 0; e < 5; e++) {
        const ex = NAMES[(day * 5 + e) % NAMES.length];
        const id = `w${n++}`;
        out.push({
          id,
          userId: "u",
          date,
          exercise: ex.name,
          category: ex.category,
          notes: null,
          createdAt: `${date}T10:0${e}:00.000Z`,
          updatedAt: `${date}T10:0${e}:00.000Z`,
          sets: Array.from({ length: 4 }, (_, s) => ({ id: `${id}-${s}`, workoutId: id, setNumber: s + 1, reps: 8 + (s % 3), weight: 40 + (day % 60) + s * 2.5 })),
        });
      }
    }
  }
  return out;
}

const time = (label: string, runs: number, fn: () => void) => {
  fn(); // warm-up
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const ms = (performance.now() - t0) / runs;
  console.log(`${label.padEnd(58)} ${ms.toFixed(2)} ms`);
  return ms;
};

export const history = syntheticHistory();
export { time, NAMES };

test("benchmark", () => {
   
  const H = require("../../utils/exerciseHistory");
   
  const { ExerciseRow } = require("../../components/workout/ExerciseRow");
  console.log(`history: ${history.length} workout records, ${history.reduce((n, w) => n + w.sets.length, 0)} sets`);

  const index = H.buildExerciseIndex(history);
  time("buildExerciseIndex (once per workouts change)", 20, () => H.buildExerciseIndex(history));

  const rows = NAMES.slice(0, 33);
  time("per render: row data (last best + format + 30-day PR) x33", 50, () => {
    for (const r of rows) {
      const h = index.get(H.exerciseKey(r.name));
      H.formatSet(H.lastBestSet(h), "kg");
      H.hadRecentPR(h, "2026-10-12");
    }
  });
  time("once per workouts change: buildExerciseSummaries", 20, () => H.buildExerciseSummaries(index));
  const summaries = H.buildExerciseSummaries(index);
  time("per render: row data via precomputed summaries x33", 50, () => {
    for (const r of rows) {
      const s = summaries.get(H.exerciseKey(r.name));
      H.prWithin(s, "2026-10-12");
    }
  });

  const renderRows = (n: number, toggle: () => void, extra = 0) =>
    rows.slice(0, n).map((r, i) => (
      <ExerciseRow key={r.name} item={r} last={"80 kg × 8"} recentPR={i % 4 === 0} added={i < extra} onToggle={toggle} />
    ));
  let tree: any | null = null;
  time("mount 33 picker rows", 10, () => {
    act(() => {
      tree = create(<>{renderRows(33, () => {})}</>);
    });
    act(() => tree!.unmount());
  });
  act(() => {
    tree = create(<>{renderRows(33, () => {})}</>);
  });
  let k = 0;
  time("re-render 33 rows after one tap (new onToggle each render)", 10, () => {
    k++;
    act(() => tree!.update(<>{renderRows(33, () => {}, k % 3)}</>));
  });
  const stable = () => {};
  time("re-render 33 rows after one tap (stable onToggle)", 10, () => {
    k++;
    act(() => tree!.update(<>{renderRows(33, stable, k % 3)}</>));
  });
  act(() => tree!.unmount());
  time("mount 10 picker rows (FlatList initialNumToRender)", 10, () => {
    act(() => {
      tree = create(<>{renderRows(10, () => {})}</>);
    });
    act(() => tree!.unmount());
  });

   
  const { MuscleIcon } = require("../../components/muscle/MuscleIcon");
  time("mount 33 MuscleIcon SVGs alone", 10, () => {
    let t: any | null = null;
    act(() => {
      t = create(<>{rows.map((r) => <MuscleIcon key={r.name} category={r.category} size={18} />)}</>);
    });
    act(() => t!.unmount());
  });

  // Session: PR flags as computed on every stepper tap before this round.
  const session = NAMES.slice(0, 3).map((n) => ({ name: n.name, sets: Array.from({ length: 4 }, () => ({ weight: 80, reps: 8, done: true })) }));
  time("session: PR flags per stepper tap (3 exercises, old way)", 50, () => {
    for (const ex of session) {
      const prior = [...H.allSets(index.get(H.exerciseKey(ex.name)))];
      for (const s of ex.sets) {
        H.checkPR(prior, { weight: s.weight, reps: s.reps });
        prior.push({ weight: s.weight, reps: s.reps });
      }
    }
  });
});
