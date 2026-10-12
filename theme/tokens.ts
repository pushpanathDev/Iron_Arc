import { Platform } from "react-native";

/*
 * Iron Arc design tokens: the single source of truth for colour, spacing,
 * radius, type, motion and elevation.
 * Rules: no gradients, no glows, no neon. Amber is reserved for streaks and PRs.
 * Role names map to Material 3 roles as noted on each field.
 */

export type ColorTokens = {
  /** M3 background / surface */
  bg: string;
  /** M3 surfaceContainerLow: cards, input fields */
  card: string;
  /** M3 surfaceContainer: raised tiles, focused inputs */
  raised: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  /** M3 outlineVariant: decorative dividers and card outlines */
  border: string;
  /** M3 outline: form control outlines, 3:1 against card and raised */
  borderStrong: string;
  /** M3 onSurface */
  text: string;
  /** M3 onSurfaceVariant */
  textSecondary: string;
  textMuted: string;
  /** M3 primary */
  accent: string;
  accentPressed: string;
  /** M3 primaryContainer */
  accentContainer: string;
  /** Tinted surface behind accent-coloured text or icons. */
  accentSubtle: string;
  /** M3 onPrimary */
  onAccent: string;
  /** Streaks and personal records only. */
  amber: string;
  /** M3 error */
  danger: string;
  dangerPressed: string;
  /** M3 errorContainer */
  dangerSubtle: string;
  onDanger: string;
  /** Same value as accent by design: there is one green. */
  success: string;
  scrim: string;
};

export const darkColors: ColorTokens = {
  bg: "#111417",
  card: "#191C1F",
  raised: "#1D2023",
  surfaceContainerHigh: "#272A2E",
  surfaceContainerHighest: "#323538",
  border: "#3D4A42",
  borderStrong: "#86948B",
  text: "#E1E2E7",
  textSecondary: "#BCCAC0",
  textMuted: "#8A939C",
  accent: "#5CDDA6",
  accentPressed: "#4CC492",
  accentContainer: "#22B07D",
  accentSubtle: "#123A2C",
  onAccent: "#003825",
  amber: "#F5A524",
  danger: "#FFB4AB",
  dangerPressed: "#F09A90",
  dangerSubtle: "#93000A",
  onDanger: "#111417",
  success: "#5CDDA6",
  scrim: "rgba(0, 0, 0, 0.6)",
};

export const lightColors: ColorTokens = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  raised: "#F7F8FA",
  surfaceContainerHigh: "#ECEEF1",
  surfaceContainerHighest: "#E2E5E9",
  border: "#DDE1E6",
  borderStrong: "#7D858E",
  text: "#121417",
  textSecondary: "#4B535C",
  textMuted: "#5E6670",
  // #168A62 gives only 4.33:1 with white text.
  accent: "#14805B",
  accentPressed: "#127351",
  accentContainer: "#B5EBD1",
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

/** Third-party brand colours, used only by their logos. */
export const brand = {
  googleBlue: "#4285F4",
  googleRed: "#EA4335",
  googleYellow: "#FBBC05",
  googleGreen: "#34A853",
};

/** Returns `hex` at the given opacity as an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Opacities for de-emphasised text. `muted` still reaches 4.5:1 on bg in dark mode. */
export const alpha = {
  muted: 0.6,
  divider: 0.7,
  /** Placeholder only: about 3.5:1, below the 4.5:1 body-text target. */
  placeholder: 0.5,
};

export const spacing = {
  xs: 4,
  /** Tailwind gap-1.5: text-to-link gap in inline rows */
  inline: 6,
  sm: 8,
  md: 12,
  lg: 16,
  form: 20,
  xl: 24,
  xxl: 32,
  /** Horizontal screen margin */
  screen: 16,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/** Minimum touch target (dp) for anything tappable. */
export const touchTarget = 48;

export const size = {
  control: 48,
  logoTile: 56,
  logoMark: 32,
  icon: 20,
  /** Minimum visual height of a text link; hitSlop extends it to touchTarget. */
  linkMin: 32,
  /** Max width for short centred copy such as subtitles. */
  textNarrow: 280,
  /** Space kept between the focused field and the keyboard, enough to keep Sign In visible. */
  keyboardClearance: 120,
  divider: 1,
};

export const motion = {
  pressScale: 0.99,
  pressMs: 120,
  focusMs: 150,
  /** Sign in / Create account crossfade, split into fade out + fade in. */
  modeMs: 200,
};

/** Font families loaded in the root layout (see theme/fonts.ts). */
export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  display: "BarlowCondensed_600SemiBold",
} as const;

// Weight comes from the font file, so roles set no fontWeight: on Android a
// fontWeight on a single-weight custom family renders synthetic or regular.
export const typography = {
  displayLg: { fontFamily: fontFamily.display, fontSize: 44, lineHeight: 48, letterSpacing: -0.88 },
  headlineLg: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 32 },
  headlineMd: { fontFamily: fontFamily.display, fontSize: 22, lineHeight: 26 },
  headlineSm: { fontFamily: fontFamily.display, fontSize: 18, lineHeight: 22, letterSpacing: 0.18 },
  bodyLg: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 },
  bodyMd: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  bodyMdMedium: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },
  labelLg: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 18 },
  labelMd: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  labelSm: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16 },
  number: {
    fontFamily: fontFamily.display,
    fontSize: 32,
    lineHeight: 36,
    fontVariant: ["tabular-nums" as const],
  },
};

/** Spread onto a text style to use the semibold face instead of a fontWeight. */
export const semibold = { fontFamily: fontFamily.semibold };

/** Letter spacing for uppercase text, from the mockup's Tailwind tracking classes. */
export const tracking = {
  /** tracking-wider (0.05em) at headlineLg 28px */
  wordmark: 1.4,
  /** tracking-wide (0.025em) at labelLg 14px */
  button: 0.35,
  /** tracking-wider (0.05em) at labelSm 12px */
  overline: 0.6,
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
