import { useThemeContext } from "../providers/ThemeContext";
import { ACCENT_PREVIEWS, type Gloss } from "./accentPreviews";
import { darkColors, lightColors, type ColorTokens } from "./tokens";

// One object per accent preview, built once, so screens' memoised values stay stable.
const previewColors = new Map<string, ColorTokens>(ACCENT_PREVIEWS.map((p) => [p.key, p.colors ? { ...darkColors, ...p.colors } : darkColors]));
const previewGloss = new Map<string, Gloss | null>(ACCENT_PREVIEWS.map((p) => [p.key, p.gloss ?? null]));

/*
 * Theme hook: the colour tokens for the active theme. Every other design
 * value (spacing, radius, typography, motion) is imported from ./tokens.
 */
export function useTheme() {
  const { resolved, accentPreview } = useThemeContext();
  const isDark = resolved === "dark";
  return {
    colors: isDark ? (previewColors.get(accentPreview) ?? darkColors) : lightColors,
    isDark,
    /** Glossy accent fills while trying a glossy preview (development builds); null otherwise. */
    gloss: previewGloss.get(accentPreview) ?? null,
  };
}
