import { useEffect, useRef } from "react";
import { AccessibilityInfo, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useTheme } from "../../theme/theme";
import { elevation, radius, spacing, touchTarget, typography } from "../../theme/tokens";

export type UndoSnackbarProps = {
  visible: boolean;
  /** e.g. "Workout deleted" */
  message: string;
  onUndo: () => void;
  /** Called when the timer runs out; commit the deletion here. */
  onTimeout: () => void;
  durationMs?: number;
  actionLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Absolutely positioned at the bottom of its parent. */
export function UndoSnackbar({
  visible,
  message,
  onUndo,
  onTimeout,
  durationMs = 5000,
  actionLabel = "Undo",
  style,
}: UndoSnackbarProps) {
  const { colors } = useTheme();
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!visible) return;
    AccessibilityInfo.announceForAccessibility(`${message}. ${actionLabel} available.`);
    const t = setTimeout(() => onTimeoutRef.current(), durationMs);
    return () => clearTimeout(t);
  }, [visible, message, actionLabel, durationMs]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      accessibilityLiveRegion="polite"
      style={[
        {
          position: "absolute",
          left: spacing.md,
          right: spacing.md,
          bottom: spacing.md,
          minHeight: 56,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: spacing.md,
          paddingRight: spacing.xxs,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.raised,
        },
        elevation.md,
        style,
      ]}
    >
      <Text style={[typography.body, { color: colors.text, flex: 1 }]} numberOfLines={2}>
        {message}
      </Text>
      <Pressable
        onPress={onUndo}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel}: ${message}`}
        style={({ pressed }) => ({
          minHeight: touchTarget,
          minWidth: touchTarget,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.sm,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.accentSubtle : "transparent",
        })}
      >
        <Text style={[typography.body, { color: colors.accent, fontWeight: "700" }]}>{actionLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default UndoSnackbar;
