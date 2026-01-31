import { ReactNode } from "react";
import { Platform, ViewStyle } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../theme/theme";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  /** Enable accent glow effect */
  glow?: boolean;
};

export default function Card({ children, style, glow = false }: Props) {
  const { colors, spacing, radius, shadows } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.duration(300).springify()}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.xl, // 20px - more premium
          padding: spacing.md,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,

          // 🔥 Premium glossy shadow
          ...Platform.select({
            ios: glow
              ? {
                  shadowColor: colors.accent,
                  shadowOpacity: 0.2,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 6 },
                }
              : {
                  shadowColor: "#000",
                  shadowOpacity: 0.1,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 6 },
                },
            android: {
              elevation: 6,
            },
          }),
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
