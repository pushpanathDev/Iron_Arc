import { useThemeContext } from "../providers/ThemeContext";
import { DEFAULT_THEME, THEMES, type AppTheme, type ThemeKey } from "./themes";
import { darkColors, lightColors, type ColorTokens } from "./tokens";

// Built once per theme, so screens' memoised values stay stable.
const themeColors = new Map<ThemeKey, ColorTokens>(THEMES.map((t) => [t.key, t.colors ? { ...darkColors, ...t.colors } : darkColors]));
const themeByKey = new Map<ThemeKey, AppTheme>(THEMES.map((t) => [t.key, t]));

/** Dark colour tokens for a theme (Profile's swatches show each one before it's picked). */
export function colorsFor(key: ThemeKey): ColorTokens {
  return themeColors.get(key) ?? darkColors;
}

/*
 * Theme hook: the colour tokens for the active theme. Every other design
 * value (spacing, radius, typography, motion) is imported from ./tokens.
 */
export function useTheme() {
  const { resolved, theme } = useThemeContext();
  const isDark = resolved === "dark";
  return {
    colors: isDark ? colorsFor(theme) : lightColors,
    isDark,
    /** Glossy fill for primary buttons and the tab bar's +; the light palette stays flat. */
    gloss: isDark ? (themeByKey.get(theme) ?? themeByKey.get(DEFAULT_THEME)!).gloss : null,
  };
}
