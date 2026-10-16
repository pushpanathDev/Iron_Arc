import type { ColorTokens } from "./tokens";

/*
 * Accent colours to try out (development builds only; Profile → "Accent colour").
 * Each replaces the accent family on the dark theme. "Glossy" versions also draw
 * the main buttons and the tab bar's + with a top-to-bottom gradient and a soft
 * shine. Not a feature: once one is chosen it moves into tokens.ts and this
 * file goes.
 */

type AccentFamily = Pick<ColorTokens, "accent" | "accentPressed" | "accentContainer" | "accentSubtle" | "accentTint" | "onAccent" | "success">;

export interface Gloss {
  /** Lighter top of the gradient. */
  top: string;
  /** Deeper bottom of the gradient. */
  bottom: string;
  /** Soft reflection over the upper half. */
  shine: string;
}

export interface AccentPreview {
  key: string;
  label: string;
  style: "flat" | "glossy";
  /** Swatch colour; also the accent when `colors` is null (the current tokens). */
  swatch: string;
  colors: AccentFamily | null;
  gloss?: Gloss;
}

const SHINE = "rgba(255, 255, 255, 0.26)";

const MINT: AccentFamily | null = null;
const EMERALD: AccentFamily = { accent: "#22D47F", accentPressed: "#1CB96E", accentContainer: "#14A05E", accentSubtle: "#0F3B26", accentTint: "#13241B", onAccent: "#00240F", success: "#22D47F" };
const COBALT: AccentFamily = { accent: "#5B9DFF", accentPressed: "#4A88E6", accentContainer: "#2F6FD6", accentSubtle: "#13294A", accentTint: "#151E2B", onAccent: "#001A3D", success: "#5B9DFF" };
const VIOLET: AccentFamily = { accent: "#A78BFA", accentPressed: "#9475EF", accentContainer: "#7C5CE0", accentSubtle: "#2A2050", accentTint: "#1C1A2B", onAccent: "#1D0E4A", success: "#A78BFA" };
const GOLD: AccentFamily = { accent: "#F2B84B", accentPressed: "#DCA33C", accentContainer: "#C08A2A", accentSubtle: "#3A2C10", accentTint: "#25211A", onAccent: "#2E1F00", success: "#F2B84B" };

export const ACCENT_PREVIEWS: AccentPreview[] = [
  { key: "mint", label: "Mint (now)", style: "flat", swatch: "#5CDDA6", colors: MINT },
  { key: "emerald", label: "Emerald", style: "flat", swatch: EMERALD.accent, colors: EMERALD },
  { key: "cobalt", label: "Cobalt", style: "flat", swatch: COBALT.accent, colors: COBALT },
  { key: "violet", label: "Violet", style: "flat", swatch: VIOLET.accent, colors: VIOLET },
  { key: "gold", label: "Gold", style: "flat", swatch: GOLD.accent, colors: GOLD },

  { key: "mint-glossy", label: "Mint", style: "glossy", swatch: "#5CDDA6", colors: MINT, gloss: { top: "#8EF0C6", bottom: "#2FB57F", shine: SHINE } },
  { key: "emerald-glossy", label: "Emerald", style: "glossy", swatch: EMERALD.accent, colors: EMERALD, gloss: { top: "#5FEFA8", bottom: "#0E9E5A", shine: SHINE } },
  { key: "cobalt-glossy", label: "Cobalt", style: "glossy", swatch: COBALT.accent, colors: COBALT, gloss: { top: "#93C0FF", bottom: "#2F6FD6", shine: SHINE } },
  { key: "violet-glossy", label: "Violet", style: "glossy", swatch: VIOLET.accent, colors: VIOLET, gloss: { top: "#C8B6FF", bottom: "#7C5CE0", shine: SHINE } },
  { key: "gold-glossy", label: "Gold", style: "glossy", swatch: GOLD.accent, colors: GOLD, gloss: { top: "#FFD98A", bottom: "#C08A2A", shine: SHINE } },
];
