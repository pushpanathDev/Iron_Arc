import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useColorScheme } from "react-native";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => Promise<void>;
}

const STORAGE_KEY = "@theme_preference";

/** While true the app always renders dark and Profile hides the theme picker. */
export const FORCE_DARK = true;

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  resolved: "dark",
  setPreference: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = useCallback(async (pref: ThemePreference) => {
    setPreferenceState(pref);
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  }, []);

  // Dark-only until a light palette is designed. The stored preference and
  // the system setting are kept (and still saved) but ignored for now.
  const resolved: ResolvedTheme = FORCE_DARK
    ? "dark"
    : preference === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : preference;

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Pins a subtree to one scheme regardless of the user's setting. */
export function ForcedThemeProvider({
  resolved,
  children,
}: {
  resolved: ResolvedTheme;
  children: React.ReactNode;
}) {
  const parent = useContext(ThemeContext);
  return (
    <ThemeContext.Provider value={{ ...parent, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  return useContext(ThemeContext);
}
