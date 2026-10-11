import { useThemeContext } from "../context/ThemeContext";

/* ============================================
   FORGE - PREMIUM DESIGN SYSTEM
   
   Inspired by: Apple Fitness+, Linear, Stripe
   Philosophy: Luxurious, glossy, motivational
   
   🎨 Premium Light Theme with Emerald Accent
   ============================================ */

/* =========================
   COLOR PALETTE
   ========================= */

// Premium Light - Soft cream/gray with rich emerald
const premiumColors = {
  // Backgrounds - Warm off-whites for depth
  background: "#F5F5F0",        // Warm cream (not pure white)
  surface: "#FFFFFF",           // Pure white for cards
  surfaceElevated: "#FAFAF8",   // Slightly elevated
  surfaceGlass: "rgba(255, 255, 255, 0.85)", // Glass effect

  // Text - Soft blacks for elegance
  textPrimary: "#1A1A1A",       // Rich black (not pure)
  textSecondary: "#4A4A4A",     // Medium gray
  textMuted: "#8A8A8A",         // Muted gray
  textOnAccent: "#FFFFFF",      // White on accent

  // Accent Colors - Rich Emerald
  accent: "#059669",            // Deep emerald (primary)
  accentLight: "#D1FAE5",       // Light emerald tint
  accentDim: "rgba(5, 150, 105, 0.12)", // Subtle accent bg
  accentGlow: "#10B981",        // Brighter for glow effects
  
  // Secondary - Indigo for charts
  secondary: "#4F46E5",         // Rich indigo
  secondaryLight: "#E0E7FF",

  // Semantic Colors
  success: "#22C55E",
  successLight: "#DCFCE7",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  error: "#EF4444",
  errorLight: "#FEE2E2",

  // Borders & Dividers - Subtle
  border: "#E8E8E3",            // Warm gray border
  divider: "#F0F0EB",           // Very subtle divider
  borderGlass: "rgba(0, 0, 0, 0.06)", // Glass border

  // Card specific - Premium glass effect
  card: "#FFFFFF",
  cardBorder: "rgba(0, 0, 0, 0.04)",
  cardShadow: "rgba(0, 0, 0, 0.08)",

  // Gradient colors - Rich emerald
  gradientStart: "#059669",
  gradientEnd: "#047857",
  gradientLight: ["#F5F5F0", "#FFFFFF"], // Subtle bg gradient

  // Chart colors
  chartPrimary: "#059669",
  chartSecondary: "#4F46E5",
  chartTertiary: "#F59E0B",
  chartBackground: "#FAFAF8",

  // Premium extras
  shimmer: "rgba(255, 255, 255, 0.6)",
  overlay: "rgba(0, 0, 0, 0.4)",

  // Training category colours (plan day/stat accents). 6-digit hex so a
  // 2-digit alpha suffix can be appended.
  categoryPush: "#7C3AED",
  categoryPull: "#2563EB",
  categoryLegs: "#D97706",
  categoryShoulders: "#0891B2",
  categoryCore: "#059669",
  categoryNeutral: "#6B7280",
};

// Keep dark colors for future use (can enable later)
const darkColors = {
  background: "#0A0A0B",
  surface: "#141414",
  surfaceElevated: "#1C1C1E",
  surfaceGlass: "rgba(255, 255, 255, 0.06)",

  textPrimary: "#FAFAFA",
  textSecondary: "#A3A3A3",
  textMuted: "#525252",
  textOnAccent: "#0A0A0B",

  accent: "#10B981",
  accentLight: "#064E3B",
  accentDim: "rgba(16, 185, 129, 0.15)",
  accentGlow: "#34D399",
  
  secondary: "#818CF8",
  secondaryLight: "#312E81",

  success: "#4ADE80",
  successLight: "#14532D",
  warning: "#FBBF24",
  warningLight: "#78350F",
  error: "#F87171",
  errorLight: "#7F1D1D",

  border: "#262626",
  divider: "#1C1C1E",
  borderGlass: "rgba(255, 255, 255, 0.08)",

  card: "#141414",
  cardBorder: "rgba(255, 255, 255, 0.06)",
  cardShadow: "rgba(0, 0, 0, 0.5)",

  gradientStart: "#10B981",
  gradientEnd: "#047857",
  gradientLight: ["#0A0A0B", "#141414"],

  chartPrimary: "#10B981",
  chartSecondary: "#818CF8",
  chartTertiary: "#FBBF24",
  chartBackground: "#1C1C1E",

  shimmer: "rgba(255, 255, 255, 0.1)",
  overlay: "rgba(0, 0, 0, 0.7)",

  categoryPush: "#A78BFA",
  categoryPull: "#60A5FA",
  categoryLegs: "#FBBF24",
  categoryShoulders: "#22D3EE",
  categoryCore: "#34D399",
  categoryNeutral: "#9CA3AF",
};

// Legacy mappings for backward compatibility
const lightColors = premiumColors;


/* =========================
   SPACING SCALE (8pt grid)
   ========================= */

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/* =========================
   BORDER RADIUS
   ========================= */

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
};

/* =========================
   SHADOWS (Premium Glossy)
   ========================= */

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  // Premium glow shadow (for accent elements)
  glow: {
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  // Card shadow for glossy effect
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
};

/* =========================
   TYPOGRAPHY SCALE
   ========================= */

export const typography = {
  // Display - Hero numbers
  display: {
    fontSize: 48,
    fontWeight: "800" as const,
    lineHeight: 52,
    letterSpacing: -1,
  },
  // H1 - Page titles
  h1: {
    fontSize: 32,
    fontWeight: "700" as const,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  // H2 - Section headers
  h2: {
    fontSize: 24,
    fontWeight: "600" as const,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  // H3 - Card titles
  h3: {
    fontSize: 18,
    fontWeight: "600" as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  // Body - Regular text
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  // Body Medium
  bodyMedium: {
    fontSize: 16,
    fontWeight: "500" as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  // Caption - Secondary text
  caption: {
    fontSize: 14,
    fontWeight: "500" as const,
    lineHeight: 20,
    letterSpacing: 0,
  },
  // Label - Small labels
  label: {
    fontSize: 12,
    fontWeight: "600" as const,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  // Stat number - Large stats
  stat: {
    fontSize: 36,
    fontWeight: "700" as const,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
};

/* =========================
   THEME HOOK
   ========================= */

export function useTheme() {
  const { resolved } = useThemeContext();
  const colors = resolved === "dark" ? darkColors : lightColors;
  const isDark = resolved === "dark";

  return { colors, spacing, radius, shadows, typography, isDark };
}
