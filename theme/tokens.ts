import { Platform } from "react-native";

/*
 * Iron Arc design tokens: the single source of truth for colour, spacing,
 * radius, type and elevation.
 * Rules: no gradients, no glows, no all-caps micro labels, no neon.
 * Amber is reserved for streaks and personal records.
 * Every text colour below reaches 4.5:1 or better on bg, card and raised.
 */

export type ColorTokens = {
  bg: string;
  card: string;
  raised: string;
  /** Decorative dividers and card outlines. */
  border: string;
  /** Form control outlines; reaches 3:1 against card and raised (WCAG 1.4.11). */
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentPressed: string;
  /** Tinted surface behind accent-coloured text or icons. */
  accentSubtle: string;
  onAccent: string;
  /** Streaks and personal records only. */
  amber: string;
  danger: string;
  dangerPressed: string;
  dangerSubtle: string;
  onDanger: string;
  /** Same value as accent by design: there is one green. */
  success: string;
  scrim: string;
};

export const darkColors: ColorTokens = {
  bg: "#0E1013",
  card: "#16191D",
  raised: "#1E2227",
  border: "#2A2F36",
  borderStrong: "#6E767F",
  text: "#F2F4F5",
  textSecondary: "#A3ABB3",
  textMuted: "#8A939C",
  accent: "#22B07D",
  accentPressed: "#1C9A6D",
  accentSubtle: "#123A2C",
  onAccent: "#0E1013",
  amber: "#F5A524",
  danger: "#F87171",
  dangerPressed: "#E25D5D",
  dangerSubtle: "#3A1E21",
  onDanger: "#0E1013",
  success: "#22B07D",
  scrim: "rgba(0, 0, 0, 0.6)",
};

export const lightColors: ColorTokens = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  raised: "#F7F8FA",
  border: "#DDE1E6",
  borderStrong: "#7D858E",
  text: "#121417",
  textSecondary: "#4B535C",
  textMuted: "#5E6670",
  // Brief asked for #168A62, which gives only 4.33:1 with white text.
  accent: "#14805B",
  accentPressed: "#127351",
  accentSubtle: "#EEF7F2",
  onAccent: "#FFFFFF",
  amber: "#9A5900",
  danger: "#C62828",
  dangerPressed: "#A82222",
  dangerSubtle: "#FDECEC",
  onDanger: "#FFFFFF",
  success: "#14805B",
  scrim: "rgba(0, 0, 0, 0.4)",
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  ml: 20,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Minimum touch target (dp) for anything tappable. */
export const touchTarget = 48;

/** Change these names when the brand font is chosen; undefined = system font. */
export const fontFamily: Record<"regular" | "medium" | "semibold" | "bold", string | undefined> = {
  regular: undefined,
  medium: undefined,
  semibold: undefined,
  bold: undefined,
};

export const typography = {
  display: { fontFamily: fontFamily.bold, fontSize: 34, lineHeight: 40, fontWeight: "700" as const, letterSpacing: -0.5 },
  title: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34, fontWeight: "700" as const, letterSpacing: -0.3 },
  heading: { fontFamily: fontFamily.semibold, fontSize: 20, lineHeight: 26, fontWeight: "600" as const },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  bodySmall: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
  number: {
    fontFamily: fontFamily.bold,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700" as const,
    fontVariant: ["tabular-nums" as const],
  },
};

const shadow = (height: number, opacity: number, blur: number, androidElevation: number) =>
  Platform.select({
    android: { elevation: androidElevation },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height },
      shadowOpacity: opacity,
      shadowRadius: blur,
    },
  });

export const elevation = {
  none: {},
  sm: shadow(1, 0.08, 3, 2),
  md: shadow(4, 0.16, 10, 6),
};
