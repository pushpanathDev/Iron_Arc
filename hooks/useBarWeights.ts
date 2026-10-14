import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useSyncExternalStore } from "react";
import { exerciseKey } from "../utils/exerciseHistory";
import { displayWeight, toKg, type WeightUnit } from "../utils/unitConversion";
import { defaultBarWeight } from "../utils/weightEntry";

const STORAGE_KEY = "IRON_ARC_BAR_WEIGHTS";

/*
 * The bar each exercise is done with (an EZ bar for curls, an Olympic bar for
 * deadlifts), remembered on this phone like the kg/lb choice. Kept in the unit
 * it was entered in, so 45 lb never drifts through kg and back.
 */
type Entry = { value: number; unit: WeightUnit };
let bars: Record<string, Entry> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

void AsyncStorage.getItem(STORAGE_KEY)
  .then((v) => {
    if (!v) return;
    const parsed = JSON.parse(v) as Record<string, Entry>;
    if (parsed && typeof parsed === "object") {
      bars = { ...parsed, ...bars };
      emit();
    }
  })
  .catch(() => {});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => bars;

export function useBarWeights() {
  const all = useSyncExternalStore(subscribe, snapshot);

  /** This exercise's bar in `unit`: the saved one, else a typical bar for it. */
  const barFor = useCallback(
    (exercise: string, unit: WeightUnit) => {
      const e = all[exerciseKey(exercise)];
      if (!e) return { value: defaultBarWeight(exercise, unit), saved: false };
      const value = e.unit === unit ? e.value : Math.round(displayWeight(toKg(e.value, e.unit), unit) * 10) / 10;
      return { value, saved: true };
    },
    [all],
  );

  const saveBar = useCallback((exercise: string, value: number, unit: WeightUnit) => {
    bars = { ...bars, [exerciseKey(exercise)]: { value, unit } };
    emit();
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bars)).catch(() => {});
  }, []);

  return { barFor, saveBar };
}
