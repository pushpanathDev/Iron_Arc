import { Platform } from "react-native";
import { darkColors, lightColors } from "../theme/tokens";

/** @deprecated Expo template palette, now derived from theme/tokens.ts. Use useTheme(). */
export const Colors = {
  light: {
    text: lightColors.text,
    background: lightColors.bg,
    tint: lightColors.accent,
    icon: lightColors.textSecondary,
    tabIconDefault: lightColors.textSecondary,
    tabIconSelected: lightColors.accent,
  },
  dark: {
    text: darkColors.text,
    background: darkColors.bg,
    tint: darkColors.accent,
    icon: darkColors.textSecondary,
    tabIconDefault: darkColors.textSecondary,
    tabIconSelected: darkColors.accent,
  },
};

/** @deprecated use fontFamily from theme/tokens.ts */
export const Fonts = Platform.select({
  ios: { sans: "system-ui", serif: "ui-serif", rounded: "ui-rounded", mono: "ui-monospace" },
  default: { sans: "normal", serif: "serif", rounded: "normal", mono: "monospace" },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
