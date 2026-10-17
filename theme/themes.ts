import type { ColorTokens } from "./tokens";

/*
 * App themes (Profile → Theme). A theme only swaps the accent family: buttons,
 * selection, toggles, progress, done marks and the tab bar's +. Colours that
 * carry a meaning never follow it:
 *   - trendGood / trendBad: better or worse (weight, volume)
 *   - amber: records, PRs and streaks
 *   - warning: goals, rest timer, pending and offline states
 *   - muscle tones: how much a muscle was trained
 *   - danger, and the ruler's `materials`
 * Rule for adding a theme: its accent must not pass for one of those. Gold is
 * kept a pale yellow gold for that reason, apart from the orange amber.
 */

type AccentFamily = Pick<ColorTokens, "accent" | "accentPressed" | "accentContainer" | "accentSubtle" | "accentTint" | "onAccent">;

export interface Gloss {
  /** Gradient colours, top to bottom; labels sit on the middle one. */
  stops: string[];
  /** Where each stop sits (0 to 1); evenly spaced when left out. */
  locations?: number[];
  /** Soft reflection over the upper half. */
  shine: string;
}

export type ThemeKey = "emerald" | "burnt-copper" | "violet" | "gold" | "sapphire";

export interface AppTheme {
  key: ThemeKey;
  label: string;
  /** The accent family over the dark tokens; null keeps tokens.ts as it is (the default). */
  colors: AccentFamily | null;
  /** Primary buttons, the tab bar's + and the week goal's tick draw this gradient. */
  gloss: Gloss;
}

const SHINE = "rgba(255, 255, 255, 0.10)";

export const DEFAULT_THEME: ThemeKey = "emerald";

export const THEMES: AppTheme[] = [
  {
    key: "emerald",
    label: "Emerald",
    colors: null,
    // Deepens to a jewel green rather than teal, so it doesn't read as mint.
    gloss: { stops: ["#34D987", "#18B96C", "#0B9455"], shine: SHINE },
  },
  {
    key: "burnt-copper",
    label: "Copper",
    colors: { accent: "#E0784A", accentPressed: "#C96A3F", accentContainer: "#A24E2A", accentSubtle: "#3D1F14", accentTint: "#241A16", onAccent: "#2B0E02" },
    gloss: { stops: ["#F0884F", "#E0784A", "#E05F3A"], shine: SHINE },
  },
  {
    key: "violet",
    label: "Violet",
    colors: { accent: "#A78BFA", accentPressed: "#9475EF", accentContainer: "#7C5CE0", accentSubtle: "#2A2050", accentTint: "#1C1A2B", onAccent: "#1D0E4A" },
    gloss: { stops: ["#B49CFF", "#A78BFA", "#8F6CF2"], shine: SHINE },
  },
  {
    key: "gold",
    label: "Gold",
    colors: { accent: "#E9C85C", accentPressed: "#D4B24B", accentContainer: "#B8922F", accentSubtle: "#3A2F12", accentTint: "#24211A", onAccent: "#2A1E00" },
    // Polished metal: a bright top, deep middle and a reflection near the bottom edge.
    gloss: { stops: ["#FFF0B8", "#EFD06E", "#D3A943", "#B98C2E", "#E2BE5E"], locations: [0, 0.3, 0.6, 0.85, 1], shine: "rgba(255, 255, 255, 0.18)" },
  },
  {
    key: "sapphire",
    label: "Sapphire",
    colors: { accent: "#5A92FF", accentPressed: "#4A80EE", accentContainer: "#2F66E8", accentSubtle: "#14284D", accentTint: "#161D2B", onAccent: "#001640" },
    // A cut gem: light at the top, deep royal blue below, a little light caught at the bottom edge.
    gloss: { stops: ["#9CC0FF", "#5A92FF", "#3268E6", "#4F86F5"], locations: [0, 0.45, 0.85, 1], shine: SHINE },
  },
];

export function isThemeKey(key: string | null): key is ThemeKey {
  return THEMES.some((t) => t.key === key);
}

/*
 * Palettes tried and set aside (kept in case one comes back):
 *   Mint (the old default)  accent #5CDDA6  pressed #4CC492  container #22B07D  subtle #123A2C  tint #172423  on #003825
 *   Amber gold (clashed)    accent #F2B84B  pressed #DCA33C  container #C08A2A  subtle #3A2C10  tint #25211A  on #2E1F00
 *   Cobalt                  accent #5B9DFF  pressed #4A88E6  container #2F6FD6  subtle #13294A  tint #151E2B  on #001A3D
 *   Light copper            accent #D08A52  pressed #B9773F  container #B4693A  subtle #3A2416  tint #231B16  on #2A1405
 * Earlier glosses: emerald #2EDC8C → #14B8A6 (read as mint), stronger ones with shine 0.26:
 * emerald #5FEFA8 → #0E9E5A, burnt copper #F4A27C → #8E4122, violet #C8B6FF → #7C5CE0.
 */
