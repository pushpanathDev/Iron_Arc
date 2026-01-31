/**
 * AnimatedSplashScreen - Iron Arc Edition
 * ========================================
 * Clean, professional splash screen with logo animation.
 * Uses the actual app logo with smooth scale and fade animations.
 */

import Constants from "expo-constants";
import { useEffect, useRef, useState } from "react";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
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

export function AnimatedSplashScreen({
  onAnimationComplete,
  isAppReady,
}: AnimatedSplashScreenProps) {
  // Animation values
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(-10);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  const containerOpacity = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const creditsOpacity = useSharedValue(0);
  const hasExited = useRef(false);

  // Track minimum display time (ensures splash always shows for at least 2.5s)
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Log splash state for debugging
  useEffect(() => {
    console.log("[Splash] Mounted, isAppReady:", isAppReady);
  }, []);

  useEffect(() => {
    console.log(
      "[Splash] State - isAppReady:",
      isAppReady,
      "minTimeElapsed:",
      minTimeElapsed,
    );
  }, [isAppReady, minTimeElapsed]);

  useEffect(() => {
    console.log("[Splash] Starting minimum time timer (2.5s)...");
    const timer = setTimeout(() => {
      console.log("[Splash] Minimum time elapsed!");
      setMinTimeElapsed(true);
    }, 2500); // Minimum 2.5 seconds to show credits

    return () => clearTimeout(timer);
  }, []);

  // Entry animation
  useEffect(() => {
    // Logo scales in with spring
    logoOpacity.value = withTiming(1, { duration: 400 });
    logoScale.value = withSpring(1, {
      damping: 12,
      stiffness: 100,
    });
    logoRotate.value = withSpring(0, {
      damping: 15,
      stiffness: 80,
    });

    // Text fades in after logo
    textOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    textTranslateY.value = withDelay(
      400,
      withSpring(0, { damping: 15, stiffness: 100 }),
    );

    // Subtle pulse on logo
    pulseScale.value = withDelay(
      800,
      withSequence(
        withTiming(1.05, { duration: 300 }),
        withTiming(1, { duration: 300 }),
      ),
    );

    // Credits fade in last
    creditsOpacity.value = withDelay(
      1000,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  // Exit animation when app is ready AND minimum time has elapsed
  useEffect(() => {
    // Wait for BOTH conditions: app ready AND minimum display time
    if (!isAppReady || !minTimeElapsed || hasExited.current) {
      console.log(
        "[Splash] Not ready to exit - isAppReady:",
        isAppReady,
        "minTimeElapsed:",
        minTimeElapsed,
        "hasExited:",
        hasExited.current,
      );
      return;
    }

    console.log("[Splash] Both conditions met! Starting exit animation...");
    const timer = setTimeout(() => {
      if (hasExited.current) return;
      hasExited.current = true;
      console.log("[Splash] Exiting...");

      // Fade out the entire container
      containerOpacity.value = withTiming(
        0,
        { duration: 400, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(onAnimationComplete)();
          }
        },
      );
    }, 200); // Small delay before fade out

    return () => clearTimeout(timer);
  }, [isAppReady, minTimeElapsed, onAnimationComplete]);

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value * pulseScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const creditsStyle = useAnimatedStyle(() => ({
    opacity: creditsOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Background gradient effect */}
      <View style={styles.backgroundGlow} />

      {/* Logo */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Brand Text */}
      <Animated.View style={[styles.textContainer, textStyle]}>
        <Text style={styles.ironText}>IRON</Text>
        <Text style={styles.arcText}>ARC</Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, textStyle]}>
        Forge Your Strength
      </Animated.Text>

      {/* Developer Credits */}
      <Animated.View style={[styles.creditsContainer, creditsStyle]}>
        <Text style={styles.creditsText}>Designed & Built by</Text>
        <Text style={styles.developerName}>Pushpanath</Text>
        <Text style={styles.versionText}>
          v{Constants.expoConfig?.version || "1.0.0"}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  backgroundGlow: {
    position: "absolute",
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.5,
    borderRadius: SCREEN_WIDTH * 0.75,
    backgroundColor: "rgba(16, 185, 129, 0.03)", // Very subtle emerald glow
    top: SCREEN_HEIGHT / 2 - SCREEN_WIDTH * 0.75,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  ironText: {
    fontSize: 18,
    fontWeight: "300",
    color: "#FFFFFF",
    letterSpacing: 10,
    marginBottom: 2,
  },
  arcText: {
    fontSize: 42,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 16,
  },
  tagline: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.5)",
    letterSpacing: 2,
    marginTop: 16,
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
