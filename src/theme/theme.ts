import { useColorScheme } from "react-native";

const lightColors = {
  background: "#F9FAFB",
  card: "#FFFFFF",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  accent: "#FF6B00", // 🔥 Burnt Orange (light)
  border: "#E5E7EB",
};

const darkColors = {
  background: "#020617", // deeper navy
  card: "#0F172A",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  accent: "#FF6B00", // burnt orange
  border: "transparent",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
};

/**
 * Typography scale (Inter)
 * Use these consistently across the app
 */
export const typography = {
  heading: {
    fontFamily: "Inter-Bold",
  },
  subheading: {
    fontFamily: "Inter-SemiBold",
  },
  body: {
    fontFamily: "Inter-Regular",
  },
  caption: {
    fontFamily: "Inter-Medium",
  },
};

export function useTheme() {
  const scheme = useColorScheme();
  const colors = scheme === "dark" ? darkColors : lightColors;

  return { colors, spacing, radius, typography };
}
