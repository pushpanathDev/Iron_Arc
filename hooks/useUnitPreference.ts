import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { WeightUnit } from "../utils/unitConversion";

const STORAGE_KEY = "IRON_ARC_WEIGHT_UNIT";

/**
 * Stores and retrieves the user's weight unit preference (kg or lbs).
 * Persisted in AsyncStorage so it survives app restarts.
 */
export function useUnitPreference() {
  const [unit, setUnitState] = useState<WeightUnit>("kg");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "lbs" || val === "kg") {
        setUnitState(val);
      }
      setLoaded(true);
    });
  }, []);

  const setUnit = useCallback(async (newUnit: WeightUnit) => {
    setUnitState(newUnit);
    await AsyncStorage.setItem(STORAGE_KEY, newUnit);
  }, []);

  const toggle = useCallback(async () => {
    const next = unit === "kg" ? "lbs" : "kg";
    setUnitState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, [unit]);

  return { unit, setUnit, toggle, loaded };
}
