import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { useTheme } from "../theme/theme";

interface SyncLoaderProps {
  visible: boolean;
  message?: string;
}

/**
 * Floating weightlifting emoji sync loader
 * Shows in bottom-right corner when syncing
 */
export function SyncLoader({ visible, message }: SyncLoaderProps) {
  const { colors, spacing, radius, shadows } = useTheme();
  
  // Animation values
  const bounce = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      // Bouncing animation
      bounce.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 300, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      );

      // Subtle rotation (like lifting)
      rotate.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 400 }),
          withTiming(5, { duration: 400 }),
          withTiming(0, { duration: 200 })
        ),
        -1,
        false
      );

      // Pulse scale
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        false
      );
    } else {
      bounce.value = withTiming(0);
      rotate.value = withTiming(0);
      scale.value = withTiming(1);
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bounce.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          ...shadows.lg,
          borderWidth: 1,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      <Animated.Text style={[styles.emoji, animatedStyle]}>
        🏋️
      </Animated.Text>
      {message && (
        <Text
          style={[
            styles.message,
            { color: colors.textSecondary },
          ]}
        >
          {message}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 100, // Above tab bar
    right: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 999,
  },
  emoji: {
    fontSize: 28,
  },
  message: {
    fontSize: 12,
    fontWeight: "500",
  },
});

export default SyncLoader;
