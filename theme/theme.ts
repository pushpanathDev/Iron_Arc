import { useThemeContext } from "../providers/ThemeContext";
import { darkColors, lightColors } from "./tokens";

/*
 * Theme hook: the colour tokens for the active theme. Every other design
 * value (spacing, radius, typography, motion) is imported from ./tokens.
 */
export function useTheme() {
  const { resolved } = useThemeContext();
  const isDark = resolved === "dark";
  return { colors: isDark ? darkColors : lightColors, isDark };
}
