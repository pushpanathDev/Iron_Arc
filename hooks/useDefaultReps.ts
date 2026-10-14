import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "IRON_ARC_DEFAULT_REPS";
export const DEFAULT_REPS_MIN = 1;
export const DEFAULT_REPS_MAX = 100;

/*
 * The user's go-to rep count (e.g. 15), offered as a one-tap chip under the
 * reps stepper when logging. Never filled in automatically. Stored on this
 * phone (a logging habit, like the kg/lb choice) and shared by every screen.
 */
let reps: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

void AsyncStorage.getItem(STORAGE_KEY)
  .then((v) => {
    const n = v ? Number(v) : NaN;
    if (Number.isInteger(n) && n >= DEFAULT_REPS_MIN && n <= DEFAULT_REPS_MAX) {
      reps = n;
      emit();
    }
  })
  .catch(() => {});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useDefaultReps() {
  const value = useSyncExternalStore(subscribe, () => reps);
  const setDefaultReps = useCallback((next: number | null) => {
    reps = next;
    emit();
    void (next == null ? AsyncStorage.removeItem(STORAGE_KEY) : AsyncStorage.setItem(STORAGE_KEY, String(next))).catch(() => {});
  }, []);
  return { defaultReps: value, setDefaultReps };
}
