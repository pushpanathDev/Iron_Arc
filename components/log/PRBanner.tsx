import { MaterialIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useTheme } from "../../theme/theme";
import { motion, radius, size, spacing, typography } from "../../theme/tokens";
import { PRBadge } from "./ExerciseRow";

export type NewRecord = { id: string; title: string; detail: string };

/** "New record!" banner; collapses by itself after motion.prBannerMs. */
export function PRBanner({ record, onDone }: { record: NewRecord; onDone: () => void }) {
  const { colors } = useTheme();

  useEffect(() => {
    const t = setTimeout(onDone, motion.prBannerMs);
    return () => clearTimeout(t);
  }, [record.id, onDone]);

  return (
    <Animated.View
      entering={FadeInDown.duration(motion.slideMs)}
      exiting={FadeOutUp.duration(motion.slideMs)}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceContainerHigh,
      }}
    >
      <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHighest }}>
        <MaterialIcons name="emoji-events" size={size.iconLg} color={colors.warning} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text style={[typography.headlineSm, { color: colors.text }]} numberOfLines={2}>
          {record.title}
        </Text>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={2}>
          {record.detail}
        </Text>
      </View>
      <PRBadge />
    </Animated.View>
  );
}

export default PRBanner;
