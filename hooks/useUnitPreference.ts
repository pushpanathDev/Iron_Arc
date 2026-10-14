import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useSyncExternalStore } from "react";
import { WeightUnit } from "../utils/unitConversion";

const STORAGE_KEY = "IRON_ARC_WEIGHT_UNIT";

/*
 * The user's weight unit (kg or lbs), persisted in AsyncStorage. One shared
 * store, so switching it on the Weight screen updates every mounted screen
 * (Home, History, Log) at once instead of each keeping its own copy.
 */
let unit: WeightUnit = "kg";
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

void AsyncStorage.getItem(STORAGE_KEY)
  .then((val) => {
    if (val === "lbs" || val === "kg") unit = val;
  })
  .catch(() => {})
  .finally(() => {
    loaded = true;
    emit();
  });

async function setUnitShared(next: WeightUnit) {
  if (next === unit) return;
  unit = next;
  emit();
  await AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useUnitPreference() {
  const current = useSyncExternalStore(subscribe, () => unit);
  const isLoaded = useSyncExternalStore(subscribe, () => loaded);
  const setUnit = useCallback((next: WeightUnit) => setUnitShared(next), []);
  const toggle = useCallback(() => setUnitShared(unit === "kg" ? "lbs" : "kg"), []);
  return { unit: current, setUnit, toggle, loaded: isLoaded };
}
