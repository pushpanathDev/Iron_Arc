import { ReactNode } from "react";
import { Platform, ViewStyle } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../src/theme/theme";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
};

export default function Card({ children, style }: Props) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.duration(300).springify()}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg + 6, // more curvy
          padding: spacing.md,
          marginBottom: spacing.md,

          // 🔥 Premium shadow
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 12,
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
