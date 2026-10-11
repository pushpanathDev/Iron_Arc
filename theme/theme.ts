import { useThemeContext } from "../context/ThemeContext";
import {
  darkColors as darkTokens,
  elevation,
  lightColors as lightTokens,
  radius as radiusTokens,
  spacing as spacingTokens,
  typography as typeTokens,
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

export const spacing = {
  ...spacingTokens,
  /** @deprecated not on the scale; use xl (32) */
  xxl: 48,
};

export const radius = {
  ...radiusTokens,
  /** @deprecated use sm */
  xs: 4,
  /** @deprecated use lg */
  xl: 20,
  /** @deprecated use lg */
  xxl: 28,
  /** @deprecated use pill */
  full: 9999,
};

/** @deprecated use `elevation`; `glow` and `card` resolve to neutral shadows. */
export const shadows = {
  sm: elevation.sm,
  md: elevation.md,
  lg: elevation.md,
  glow: elevation.md,
  card: elevation.sm,
};

const f = typeTokens.body.fontFamily;

/** @deprecated legacy scale kept so existing screens render unchanged; use `typography` from ./tokens. */
export const typography = {
  display: { fontFamily: f, fontSize: 48, fontWeight: "800" as const, lineHeight: 52, letterSpacing: -1 },
  h1: { fontFamily: f, fontSize: 32, fontWeight: "700" as const, lineHeight: 40, letterSpacing: -0.5 },
  h2: { fontFamily: f, fontSize: 24, fontWeight: "600" as const, lineHeight: 32, letterSpacing: -0.3 },
  h3: { fontFamily: f, fontSize: 18, fontWeight: "600" as const, lineHeight: 24, letterSpacing: 0 },
  body: typeTokens.body,
  bodyMedium: { fontFamily: f, fontSize: 16, fontWeight: "500" as const, lineHeight: 24, letterSpacing: 0 },
  caption: { fontFamily: f, fontSize: 14, fontWeight: "500" as const, lineHeight: 20, letterSpacing: 0 },
  label: {
    fontFamily: f,
    fontSize: 12,
    fontWeight: "600" as const,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  stat: { fontFamily: f, fontSize: 36, fontWeight: "700" as const, lineHeight: 40, letterSpacing: -0.5 },
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
