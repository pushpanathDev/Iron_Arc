import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../theme/theme";

const { width, height } = Dimensions.get("window");
const APP_VERSION = "1.1.1";

interface ForgeSplashProps {
  onFinish: () => void;
  duration?: number;
}

/**
 * FORGE Animated Splash Screen
 * Shows app branding with exciting animations
 */
export function ForgeSplash({ onFinish, duration = 2500 }: ForgeSplashProps) {
  const { colors } = useTheme();

  // Animation shared values
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const emojiScale = useSharedValue(0);
  const emojiRotate = useSharedValue(-180);
  const emojiBounce = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(30);
  const versionOpacity = useSharedValue(0);
  const sparkle1 = useSharedValue(0);
  const sparkle2 = useSharedValue(0);
  const sparkle3 = useSharedValue(0);
  const flameFlicker = useSharedValue(0);

  useEffect(() => {
    // Sequence of animations

    // 1. Emoji entrance (spin + scale)
    emojiScale.value = withDelay(
      200,
      withSpring(1, { damping: 8, stiffness: 100 }),
    );
    emojiRotate.value = withDelay(
      200,
      withSpring(0, { damping: 12, stiffness: 80 }),
    );

    // 2. Emoji continuous bounce
    emojiBounce.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(-15, { duration: 400, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );

    // 3. Flame flicker effect
    flameFlicker.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 150 }),
          withTiming(0.7, { duration: 150 }),
          withTiming(1, { duration: 100 }),
        ),
        -1,
        false,
      ),
    );

    // 4. Logo text fade in + slide up
    textOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));
    textTranslateY.value = withDelay(
      500,
      withSpring(0, { damping: 12, stiffness: 100 }),
    );

    // 5. Sparkle effects
    sparkle1.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0, { duration: 300 }),
        ),
        -1,
        false,
      ),
    );
    sparkle2.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0, { duration: 400 }),
        ),
        -1,
        false,
      ),
    );
    sparkle3.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 350 }),
          withTiming(0, { duration: 350 }),
        ),
        -1,
        false,
      ),
    );

    // 6. Version fade in
    versionOpacity.value = withDelay(1000, withTiming(1, { duration: 500 }));

    // 7. Finish after duration
    const timer = setTimeout(() => {
      onFinish();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  // Animated styles
  const emojiAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: emojiScale.value },
      { rotate: `${emojiRotate.value}deg` },
      { translateY: emojiBounce.value },
    ],
    opacity: interpolate(emojiScale.value, [0, 0.5, 1], [0, 0.8, 1]),
  }));

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameFlicker.value || 1 }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const versionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: versionOpacity.value,
  }));

  const sparkle1Style = useAnimatedStyle(() => ({
    opacity: sparkle1.value,
    transform: [{ scale: sparkle1.value }],
  }));

  const sparkle2Style = useAnimatedStyle(() => ({
    opacity: sparkle2.value,
    transform: [{ scale: sparkle2.value }],
  }));

  const sparkle3Style = useAnimatedStyle(() => ({
    opacity: sparkle3.value,
    transform: [{ scale: sparkle3.value }],
  }));

  return (
    <LinearGradient
      colors={["#1a1a2e", "#16213e", "#0f0f23"]}
      style={styles.container}
    >
      {/* Background glow effect */}
      <View style={styles.glowContainer}>
        <Animated.View
          style={[
            styles.glow,
            flameStyle,
            { backgroundColor: "rgba(255, 107, 53, 0.15)" },
          ]}
        />
      </View>

      {/* Sparkles */}
      <Animated.Text style={[styles.sparkle, styles.sparkle1, sparkle1Style]}>
        ✨
      </Animated.Text>
      <Animated.Text style={[styles.sparkle, styles.sparkle2, sparkle2Style]}>
        💪
      </Animated.Text>
      <Animated.Text style={[styles.sparkle, styles.sparkle3, sparkle3Style]}>
        ⚡
      </Animated.Text>

      {/* Main content */}
      <View style={styles.content}>
        {/* Animated Emoji */}
        <Animated.View style={[styles.emojiContainer, emojiAnimatedStyle]}>
          <Animated.Text style={[styles.emoji, flameStyle]}>🔥</Animated.Text>
          <Text style={styles.emojiShadow}>🏋️</Text>
          <Text style={styles.mainEmoji}>🏋️</Text>
        </Animated.View>

        {/* App Name */}
        <Animated.View style={textAnimatedStyle}>
          <Text style={styles.appName}>IRON ARC</Text>
          <Text style={styles.tagline}>Forge Your Strength</Text>
        </Animated.View>
      </View>

      {/* Version at bottom */}
      <Animated.View style={[styles.versionContainer, versionAnimatedStyle]}>
        <Text style={styles.version}>v{APP_VERSION}</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  glowContainer: {
    position: "absolute",
    top: "30%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  glow: {
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  content: {
    alignItems: "center",
  },
  emojiContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emoji: {
    fontSize: 40,
    position: "absolute",
    top: -10,
  },
  emojiShadow: {
    fontSize: 80,
    position: "absolute",
    opacity: 0.3,
    transform: [{ translateY: 4 }],
  },
  mainEmoji: {
    fontSize: 80,
  },
  appName: {
    fontSize: 48,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 8,
    textShadowColor: "rgba(255, 107, 53, 0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  tagline: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
    letterSpacing: 4,
    marginTop: 8,
    textTransform: "uppercase",
  },
  sparkle: {
    position: "absolute",
    fontSize: 24,
  },
  sparkle1: {
    top: "25%",
    left: "15%",
  },
  sparkle2: {
    top: "35%",
    right: "12%",
  },
  sparkle3: {
    top: "55%",
    left: "20%",
  },
  versionContainer: {
    position: "absolute",
    bottom: 50,
  },
  version: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 14,
    letterSpacing: 2,
  },
});

export default ForgeSplash;
