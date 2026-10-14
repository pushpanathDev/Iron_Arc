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
  /** M3 surfaceContainerLowest: inset fields and wells inside cards */
  surfaceContainerLowest: string;
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
  /** Accent at ~8% over the surface: highlighted cards (Home's Today card). */
  accentTint: string;
  /** M3 onPrimary */
  onAccent: string;
  /** Streaks and personal records only. */
  amber: string;
  /** Achievement tiers (gold is amber, the records colour). */
  tierBronze: string;
  tierSilver: string;
  /** Muscle tones (body map, muscle icons): more sets a week → stronger coral. Never used for errors. */
  muscleLow: string;
  muscleMid: string;
  muscleTarget: string;
  muscleHigh: string;
  /** M3 secondary: warnings and pending states (offline, waking server). */
  warning: string;
  /** M3 onSecondary */
  onWarning: string;
  /** M3 error */
  danger: string;
  dangerPressed: string;
  /** M3 errorContainer */
  dangerSubtle: string;
  /** Soft red gradient (top → bottom) for a calm destructive button, e.g. the delete dialog. */
  dangerGradientTop: string;
  dangerGradientBottom: string;
  onDanger: string;
  /** Same value as accent by design: there is one green. */
  success: string;
  /** Progress colours (weight changes): toward the goal / away from it. Brighter than accent/danger; used only for change values. */
  trendGood: string;
  trendBad: string;
  scrim: string;
};

export const darkColors: ColorTokens = {
  bg: "#111417",
  card: "#191C1F",
  raised: "#1D2023",
  surfaceContainerHigh: "#272A2E",
  surfaceContainerHighest: "#323538",
  surfaceContainerLowest: "#0B0E11",
  border: "#3D4A42",
  borderStrong: "#86948B",
  text: "#E1E2E7",
  textSecondary: "#BCCAC0",
  textMuted: "#8A939C",
  accent: "#5CDDA6",
  accentPressed: "#4CC492",
  accentContainer: "#22B07D",
  accentSubtle: "#123A2C",
  accentTint: "#172423",
  onAccent: "#003825",
  amber: "#F5A524",
  tierBronze: "#D08B5B",
  tierSilver: "#B9C3CC",
  muscleLow: "#5E3B36",
  muscleMid: "#A4523F",
  muscleTarget: "#E2735A",
  muscleHigh: "#FF8A5C",
  warning: "#FFB957",
  onWarning: "#462B00",
  danger: "#FFB4AB",
  dangerPressed: "#F09A90",
  dangerSubtle: "#93000A",
  dangerGradientTop: "#4A2427",
  dangerGradientBottom: "#33191C",
  onDanger: "#111417",
  success: "#5CDDA6",
  trendGood: "#3EE08F",
  trendBad: "#FF6B6B",
  scrim: "rgba(0, 0, 0, 0.6)",
};

export const lightColors: ColorTokens = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  raised: "#F7F8FA",
  surfaceContainerHigh: "#ECEEF1",
  surfaceContainerHighest: "#E2E5E9",
  // Light mode is disabled (FORCE_DARK); reuses the dark value until a light palette is designed.
  surfaceContainerLowest: "#0B0E11",
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
  // Light mode is disabled (FORCE_DARK); reuses the dark value.
  accentTint: "#172423",
  onAccent: "#FFFFFF",
  amber: "#9A5900",
  tierBronze: "#8A4B22",
  tierSilver: "#5B6672",
  muscleLow: "#F4D3C9",
  muscleMid: "#E59A84",
  muscleTarget: "#D2603F",
  muscleHigh: "#B43E1F",
  // Light mode is disabled (FORCE_DARK); reuses the dark values.
  warning: "#FFB957",
  onWarning: "#462B00",
  danger: "#C62828",
  dangerPressed: "#A82222",
  dangerSubtle: "#FDECEC",
  dangerGradientTop: "#FDECEC",
  dangerGradientBottom: "#F8DADA",
  onDanger: "#FFFFFF",
  success: "#14805B",
  trendGood: "#0F7A4A",
  trendBad: "#C62828",
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
  /** Ruler values two steps from the selection */
  faint: 0.3,
  /** Ruler values further away */
  ghost: 0.15,
  /** Tinted highlight band (primary/10) */
  band: 0.1,
  /** Shimmer highlight over skeleton blocks */
  shimmer: 0.06,
  /** Not-yet-reached items (future days) */
  half: 0.5,
  /** Accent border on accentTint cards (primary/25) */
  tintBorder: 0.25,
  divider: 0.7,
  /** Placeholder only: about 3.5:1, below the 4.5:1 body-text target. */
  placeholder: 0.5,
};

export const spacing = {
  /** Hairline inset (Tailwind p-0.5), e.g. inside segmented toggles */
  xxs: 2,
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
  /** Max width of centred dialogs. */
  dialogMax: 400,
  divider: 1,
  iconSm: 18,
  iconLg: 24,
  /** Small status dot (Tailwind w-1.5) and week-bar segment height */
  dot: 6,
  /** Goal-card selection dot (w-2.5) */
  goalDot: 10,
  /** Header bar height (h-14) */
  appBar: 56,
  /** Tall end-of-form call to action */
  ctaTall: 52,
  /** Goal option card height (h-32) */
  goalCard: 128,
  /** Demo chart height on the intro (h-24) */
  chart: 96,
  /** Status dot (w-2) */
  statusDot: 8,
  /** Round icon badge on full-screen states (w-16) */
  iconBadge: 64,
  /** Startup progress ring (w-28) and its stroke */
  ring: 112,
  ringStroke: 3,
  /** Bottom tab bar height, excluding the bottom inset */
  tabBar: 64,
  tabIcon: 22,
  /** Minimum width of a tab's touch area */
  tabMin: 56,
  /** Centre Log button */
  logButton: 48,
  /** Offline banner minimum height */
  banner: 36,
  /** Square icon tile inside toasts */
  toastIcon: 36,
  /** Home weekly progress ring */
  homeRing: 80,
  /** Profile avatar in headers */
  avatar: 40,
  /** Icon inside small rings and badges */
  iconXs: 14,
  /** Thin progress bar */
  progressBar: 4,
  /** Workouts-card progress ring and its stroke */
  ringSm: 40,
  ringSmStroke: 4,
  /** Line joining consecutive trained days in the streak chain */
  chainLine: 2,
  /** Small icon tile / mini progress ring (w-8) */
  tileSm: 32,
  /** Log picker category tile height. */
  categoryTile: 72,
  /** Log picker exercise row height. */
  exerciseRow: 64,
  /** Muscle icon on category tiles. */
  muscleIcon: 32,
  /** Log session check box in the LOG column. */
  checkBox: 28,
  /** Log session SET column width. */
  setColumn: 40,
  /** Log session exercise chip: longest before the name truncates. */
  chipMax: 200,
  /** Weight trend chart height. */
  trendChart: 140,
  /** Analytics activity bars: widest bar, and the pill on a rest day. */
  barMax: 28,
  restPill: 12,
  /** Analytics summary tiles (Workouts, Volume, Streak). */
  statTile: 92,
  /** Axis labels inside charts. */
  chartLabel: 10,
  /** Bathroom scale (Weight screen): height as a share of width, corner radius, reading window height. */
  scaleAspect: 0.92,
  scaleCorner: 28,
  scaleWindow: 64,
  /** Numbers printed on the scale tape. */
  tapeLabel: 16,
  /** Icon tile in Home rows */
  rowIcon: 40,
};

/** Vertical height ruler (profile setup). */
export const ruler = {
  height: 144,
  item: 30,
  band: 36,
  labelWidth: 40,
  tick: 16,
  tickMinor: 8,
  tickActive: 32,
  tickActiveMinor: 12,
  stroke: 2,
  strokeActive: 4,
};

export const motion = {
  pressScale: 0.99,
  /** Stronger press for small round buttons (Log) */
  pressScaleStrong: 0.95,
  /** Skeleton shimmer loop */
  shimmerMs: 2000,
  /** Status-dot pulse half-cycle */
  pulseMs: 800,
  /** Banner and toast slide */
  slideMs: 220,
  /** Cycling headline: slide/fade duration and time each message stays */
  headlineSwapMs: 700,
  headlineHoldMs: 4500,
  /** Numbers counting up from 0 on first load */
  countUpMs: 400,
  pressMs: 120,
  focusMs: 150,
  /** Sign in / Create account crossfade, split into fade out + fade in. */
  modeMs: 200,
  /** Hold-to-repeat on steppers: first repeat, then the fastest rate. */
  repeatDelayMs: 300,
  repeatMs: 80,
  /** New-record banner stays expanded this long. */
  prBannerMs: 4000,
  /** Scale tape: slightly under-damped (about 5% overshoot), so it rolls past and settles like a mechanical scale. */
  scaleSpring: { damping: 11, stiffness: 55, mass: 1.1 },
  /** Platform dipping when someone steps on. */
  pressSpring: { damping: 14, stiffness: 180, mass: 1 },
  /** Pause before the scale first steps on by itself. */
  dialStepOnMs: 180,
  /** Card entrances (Reveal): duration, delay between cards, cap on steps, rise distance (px). */
  revealMs: 340,
  revealStaggerMs: 55,
  revealMaxSteps: 6,
  revealOffset: 14,
  /** Typed weight moves the reading once typing pauses this long. */
  dialTypeDebounceMs: 350,
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
  displayMd: { fontFamily: fontFamily.display, fontSize: 36, lineHeight: 40, letterSpacing: -0.36 },
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
  /** tracking-wider (0.05em) at labelSm/labelMd 12px */
  overline: 0.6,
  /** tracking-wide (0.025em) at labelMd 12px */
  labelWide: 0.3,
  /** tracking-wide (0.025em) at headlineSm 18px */
  headlineWide: 0.45,
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
