import { MaterialIcons } from "@expo/vector-icons";
import { type ComponentProps, useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../theme/theme";
import { alpha, motion, radius, size, spacing, typography } from "../../theme/tokens";

/** Small dot that gently pulses; static when reduce-motion is on. */
export function PulsingDot({ color, dotSize = size.statusDot }: { color: string; dotSize?: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(alpha.faint, { duration: motion.pulseMs }), -1, true);
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width: dotSize, height: dotSize, borderRadius: radius.full, backgroundColor: color }, style]} />;
}

type IconName = ComponentProps<typeof MaterialIcons>["name"];

/** Continuously rotating icon (e.g. "sync"); static when reduce-motion is on. */
export function SpinningIcon({ name = "sync", color, iconSize = size.icon }: { name?: IconName; color: string; iconSize?: number }) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    turn.value = withRepeat(withTiming(1, { duration: motion.shimmerMs / 2, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [reduceMotion, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <Animated.View style={style}>
      <MaterialIcons name={name} size={iconSize} color={color} />
    </Animated.View>
  );
}

/** Pill with a pulsing dot, e.g. "Syncing" or "Connecting". */
export function StatusPill({ label, dotColor }: { label: string; dotColor: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        backgroundColor: colors.card,
      }}
    >
      <PulsingDot color={dotColor} />
      <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}
