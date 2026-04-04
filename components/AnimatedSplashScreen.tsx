/**
 * AnimatedSplashScreen - Iron Arc Edition
 * ========================================
 * Premium splash screen with dual-condition logic:
 * - Minimum 3-second display time (animation plays fully)
 * - Waits for app initialization to complete
 * - Smooth exit animation when both conditions met
 * - Safety guard prevents getting stuck
 */

import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
  isAppReady: boolean;
}

/** Minimum time to display splash screen (allows animation to feel intentional) */
const MINIMUM_SPLASH_DURATION_MS = 3000;

/** Maximum time to wait for app initialization before forcing exit (safety guard) */
const MAXIMUM_SPLASH_DURATION_MS = 15000;

/** Duration of entry animation sequence */
const SPLASH_ENTRY_ANIMATION_MS = 2800;

const PARTICLES = [
  { x: 0.18, y: 0.22, size: 3, delay: 400, drift: -10 },
  { x: 0.72, y: 0.28, size: 2, delay: 700, drift: -14 },
  { x: 0.35, y: 0.62, size: 2, delay: 900, drift: -8 },
  { x: 0.62, y: 0.66, size: 3, delay: 1100, drift: -12 },
  { x: 0.48, y: 0.4, size: 1.5, delay: 600, drift: -6 },
  { x: 0.27, y: 0.78, size: 2, delay: 1300, drift: -10 },
];

export function AnimatedSplashScreen({
  onAnimationComplete,
  isAppReady,
}: AnimatedSplashScreenProps) {
  // Animation values
  const logoScale = useSharedValue(0.96);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  const containerOpacity = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const creditsOpacity = useSharedValue(0);
  const particlesOpacity = useSharedValue(0);
  const particlesDrift = useSharedValue(0);
  const backgroundOpacity = useSharedValue(0);

  // Tracking refs for exit logic
  const hasExited = useRef(false);
  const mountTime = useRef(Date.now());

  /**
   * CONDITION 1: Minimum splash duration has passed
   * Ensures animation feels intentional, not abrupt
   */
  const [minTimePassed, setMinTimePassed] = useState(false);

  /**
   * CONDITION 2: App is ready (from props)
   * Tracks when all initialization is complete
   */
  const [appReady, setAppReady] = useState(isAppReady);

  // Log splash lifecycle on mount
  useEffect(() => {
    console.log("[Splash] Mounted - starting dual-condition countdown");
    return () => {
      if (!hasExited.current) {
        console.warn(
          "[Splash] Component unmounted before exit (unexpected cleanup)",
        );
      }
    };
  }, []);

  // Update appReady state whenever prop changes
  useEffect(() => {
    setAppReady(isAppReady);
    if (isAppReady) {
      console.log(
        "[Splash] App ready signal received",
        `(elapsed: ${Date.now() - mountTime.current}ms)`,
      );
    }
  }, [isAppReady]);

  /**
   * CONDITION 1: Minimum time gate
   * Waits MINIMUM_SPLASH_DURATION_MS before allowing exit
   */
  useEffect(() => {
    const minTimer = setTimeout(() => {
      console.log("[Splash] Minimum duration reached (3s)");
      setMinTimePassed(true);
    }, MINIMUM_SPLASH_DURATION_MS);

    return () => clearTimeout(minTimer);
  }, []);

  /**
   * SAFETY GUARD: Maximum time gate
   * Forces exit after MAXIMUM_SPLASH_DURATION_MS even if not fully ready
   * Prevents splash from getting stuck (e.g., if initialization stalls)
   */
  useEffect(() => {
    const maxTimer = setTimeout(() => {
      if (!hasExited.current) {
        console.warn(
          "[Splash] Max duration reached (15s), forcing exit for safety",
        );
        setAppReady(true); // Force condition satisfied to trigger exit
      }
    }, MAXIMUM_SPLASH_DURATION_MS);

    return () => clearTimeout(maxTimer);
  }, []);

  /**
   * DUAL-CONDITION EXIT LOGIC
   * Triggers when: minTimePassed AND (appReady OR maxDuration exceeded)
   */
  useEffect(() => {
    // Not ready to exit yet
    if (!minTimePassed || !appReady || hasExited.current) {
      const elapsed = Date.now() - mountTime.current;
      const minReady = minTimePassed ? "✓" : "⏳";
      const appReadyReady = appReady ? "✓" : "⏳";
      if (minTimePassed !== appReady) {
        // Only log when conditions differ (to avoid spam)
        console.log(
          `[Splash] Waiting - Min: ${minReady} (${elapsed}ms) | App: ${appReadyReady}`,
        );
      }
      return;
    }

    // Both conditions satisfied - time to exit!
    console.log(
      "[Splash] Both conditions met! Starting exit animation...",
      `(total time: ${Date.now() - mountTime.current}ms)`,
    );

    const exitTimer = setTimeout(() => {
      if (hasExited.current) return;
      hasExited.current = true;

      // Smooth fade out exit animation
      containerOpacity.value = withTiming(
        0,
        { duration: 300, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) {
            console.log("[Splash] Exit animation complete - calling callback");
            runOnJS(onAnimationComplete)();
          }
        },
      );
    }, 100); // Small delay before exit to ensure smooth transition

    return () => clearTimeout(exitTimer);
  }, [minTimePassed, appReady, onAnimationComplete]);

  // Entry animation
  useEffect(() => {
    // Background fade in
    backgroundOpacity.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });

    // Logo/text fade + subtle scale in
    logoOpacity.value = withDelay(600, withTiming(1, { duration: 700 }));
    logoScale.value = withDelay(
      600,
      withSpring(1, {
        damping: 14,
        stiffness: 90,
      }),
    );

    // Text fades in after logo
    textOpacity.value = withDelay(
      800,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
    textTranslateY.value = withDelay(
      800,
      withSpring(0, { damping: 16, stiffness: 90 }),
    );

    // Subtle pulse on logo
    pulseScale.value = withDelay(
      1400,
      withSequence(
        withTiming(1.03, { duration: 500 }),
        withTiming(1, { duration: 500 }),
      ),
    );

    // Particles
    particlesOpacity.value = withDelay(700, withTiming(1, { duration: 900 }));
    particlesDrift.value = withDelay(
      700,
      withTiming(-16, { duration: 2000, easing: Easing.out(Easing.quad) }),
    );

    // Credits fade in last
    creditsOpacity.value = withDelay(
      2200,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  // Cleanup: ensure no timers leak
  useEffect(() => {
    return () => {
      if (!hasExited.current) {
        console.log("[Splash] Component unmounting - ensuring clean exit");
        hasExited.current = true;
      }
    };
  }, []);

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value * pulseScale.value },
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const creditsStyle = useAnimatedStyle(() => ({
    opacity: creditsOpacity.value,
  }));

  const particlesStyle = useAnimatedStyle(() => ({
    opacity: particlesOpacity.value,
    transform: [{ translateY: particlesDrift.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.backgroundLayer, backgroundStyle]}>
        <LinearGradient
          colors={["#05070D", "#0B1220", "#0F1A2E", "#0B1220"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
        <View style={styles.glowTopLeft} />
        <View style={styles.glowBottomRight} />
        <View style={styles.glowCenter} />
      </Animated.View>

      {/* Subtle particles */}
      <Animated.View style={[styles.particlesLayer, particlesStyle]}>
        {PARTICLES.map((particle, index) => (
          <View
            key={index}
            style={[
              styles.particle,
              {
                width: particle.size,
                height: particle.size,
                left: SCREEN_WIDTH * particle.x,
                top: SCREEN_HEIGHT * particle.y,
                opacity: 0.35,
                transform: [{ translateY: particle.drift }],
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* Brand Text */}
      <Animated.View style={[styles.textContainer, logoStyle]}>
        <Text style={styles.ironText}>IRON</Text>
        <Text style={styles.arcText}>ARC</Text>
      </Animated.View>

      <Animated.Text style={[styles.tagline, textStyle]}>
        Train with discipline.
      </Animated.Text>

      {/* Developer Credits */}
      <Animated.View style={[styles.creditsContainer, creditsStyle]}>
        <Text style={styles.creditsText}>Designed & Built by</Text>
        <Text style={styles.developerName}>Pushpanath</Text>
        <Text style={styles.versionText}>
          v{Constants.expoConfig?.version || "1.1.1"}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0B1220",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  glowTopLeft: {
    position: "absolute",
    width: SCREEN_WIDTH * 1.1,
    height: SCREEN_WIDTH * 1.1,
    borderRadius: SCREEN_WIDTH * 0.55,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    top: -SCREEN_WIDTH * 0.45,
    left: -SCREEN_WIDTH * 0.35,
  },
  glowBottomRight: {
    position: "absolute",
    width: SCREEN_WIDTH * 1.3,
    height: SCREEN_WIDTH * 1.3,
    borderRadius: SCREEN_WIDTH * 0.65,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    bottom: -SCREEN_WIDTH * 0.5,
    right: -SCREEN_WIDTH * 0.4,
  },
  glowCenter: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: SCREEN_WIDTH * 0.45,
    backgroundColor: "rgba(16, 185, 129, 0.05)",
    top: SCREEN_HEIGHT * 0.22,
    left: SCREEN_WIDTH * 0.05,
  },
  particlesLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  ironText: {
    fontSize: 18,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.68)",
    letterSpacing: 14,
    marginBottom: 6,
  },
  arcText: {
    fontSize: 52,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 18,
    textShadowColor: "rgba(16, 185, 129, 0.2)",
    textShadowRadius: 18,
  },
  tagline: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
    letterSpacing: 2.5,
    marginTop: 18,
  },
  creditsContainer: {
    position: "absolute",
    bottom: 60,
    alignItems: "center",
  },
  creditsText: {
    fontSize: 11,
    fontWeight: "300",
    color: "rgba(255, 255, 255, 0.4)",
    letterSpacing: 1,
  },
  developerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 2,
    marginTop: 4,
  },
  versionText: {
    fontSize: 10,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.3)",
    marginTop: 8,
  },
});

export default AnimatedSplashScreen;
