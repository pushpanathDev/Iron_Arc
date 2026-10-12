import { useThemeContext } from "../context/ThemeContext";
import {
  darkColors as darkTokens,
  elevation,
  lightColors as lightTokens,
  fontFamily,
  type ColorTokens,
} from "./tokens";

/*
 * Theme hook plus backward-compatible aliases. Values live in ./tokens.ts.
 * New code: use the token names (bg, card, raised, text, accent, ...) and
 * import `typography` from ./tokens.
 */

const legacyOnly = {
  dark: {
    secondary: "#818CF8",
    secondaryLight: "#312E81",
    warning: "#FBBF24",
    warningLight: "#78350F",
    chartSecondary: "#818CF8",
    chartTertiary: "#FBBF24",
    shimmer: "rgba(255, 255, 255, 0.1)",
    categoryPush: "#A78BFA",
    categoryPull: "#60A5FA",
    categoryLegs: "#FBBF24",
    categoryShoulders: "#22D3EE",
    categoryCore: "#34D399",
    categoryNeutral: "#9CA3AF",
  },
  light: {
    secondary: "#4F46E5",
    secondaryLight: "#E0E7FF",
    warning: "#B45309",
    warningLight: "#FEF3C7",
    chartSecondary: "#4F46E5",
    chartTertiary: "#F59E0B",
    shimmer: "rgba(255, 255, 255, 0.6)",
    categoryPush: "#7C3AED",
    categoryPull: "#2563EB",
    categoryLegs: "#D97706",
    categoryShoulders: "#0891B2",
    categoryCore: "#059669",
    categoryNeutral: "#6B7280",
  },
};

function buildPalette(t: ColorTokens, extra: (typeof legacyOnly)["dark"]) {
  return {
    ...t,
    ...extra,
    /** @deprecated use bg */
    background: t.bg,
    /** @deprecated use card */
    surface: t.card,
    /** @deprecated use raised */
    surfaceElevated: t.raised,
    /** @deprecated use raised (no glass effects) */
    surfaceGlass: t.raised,
    /** @deprecated use text */
    textPrimary: t.text,
    /** @deprecated use onAccent */
    textOnAccent: t.onAccent,
    /** @deprecated use accentSubtle */
    accentLight: t.accentSubtle,
    /** @deprecated use accentSubtle */
    accentDim: t.accentSubtle,
    /** @deprecated no glows; resolves to accent */
    accentGlow: t.accent,
    /** @deprecated use accentSubtle */
    successLight: t.accentSubtle,
    /** @deprecated use danger */
    error: t.danger,
    /** @deprecated use dangerSubtle */
    errorLight: t.dangerSubtle,
    /** @deprecated use border */
    divider: t.border,
    /** @deprecated use border */
    borderGlass: t.border,
    /** @deprecated use border */
    cardBorder: t.border,
    /** @deprecated shadows come from elevation */
    cardShadow: "#000000",
    /** @deprecated no gradients; resolves to a flat accent */
    gradientStart: t.accent,
    /** @deprecated no gradients; resolves to a flat accent */
    gradientEnd: t.accent,
    /** @deprecated no gradients; resolves to a flat bg */
    gradientLight: [t.bg, t.bg],
    /** @deprecated use accent */
    chartPrimary: t.accent,
    /** @deprecated use raised */
    chartBackground: t.raised,
    /** @deprecated use scrim */
    overlay: t.scrim,
  };
}

const darkPalette = buildPalette(darkTokens, legacyOnly.dark);
const lightPalette: typeof darkPalette = buildPalette(lightTokens, legacyOnly.light);

export type ThemeColors = typeof darkPalette;

/**
 * @deprecated Legacy scale for screens not yet redesigned. Values are pinned so
 * those layouts don't shift; new code uses `spacing` from ./tokens.
 */
export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 };

/** @deprecated Legacy radii, pinned. New code uses `radius` from ./tokens. */
export const radius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, full: 9999 };

/** @deprecated use `elevation`; `glow` and `card` resolve to neutral shadows. */
export const shadows = {
  sm: elevation.sm,
  md: elevation.md,
  lg: elevation.md,
  glow: elevation.md,
  card: elevation.sm,
};

/**
 * @deprecated Legacy type scale, sizes pinned, now set in Inter / Barlow
 * Condensed. New code uses `typography` from ./tokens.
 */
export const typography = {
  display: { fontFamily: fontFamily.display, fontSize: 48, lineHeight: 52, letterSpacing: -1 },
  h1: { fontFamily: fontFamily.display, fontSize: 32, lineHeight: 40 },
  h2: { fontFamily: fontFamily.display, fontSize: 24, lineHeight: 32 },
  h3: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  stat: { fontFamily: fontFamily.display, fontSize: 36, lineHeight: 40 },
};

export function getPalette(isDark: boolean): ThemeColors {
  return isDark ? darkPalette : lightPalette;
}

export function useTheme() {
  const { resolved } = useThemeContext();
  const isDark = resolved === "dark";
  const colors = getPalette(isDark);

  return { colors, spacing, radius, shadows, elevation, typography, isDark };
}
