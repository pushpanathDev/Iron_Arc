/**
 * Launch animation. Leaves once the app is ready, but never before
 * MIN_VISIBLE_MS (so it reads as intentional) and never after MAX_VISIBLE_MS.
 */

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

import { getVersionLabel } from "../../utils/appVersion";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
  isAppReady: boolean;
}

const MIN_VISIBLE_MS = 1200;
/** Opens the app anyway if startup stalls. */
const MAX_VISIBLE_MS = 15000;

const PARTICLES = [
  { x: 0.18, y: 0.22, size: 3, drift: -10 },
  { x: 0.72, y: 0.28, size: 2, drift: -14 },
  { x: 0.35, y: 0.62, size: 2, drift: -8 },
  { x: 0.62, y: 0.66, size: 3, drift: -12 },
  { x: 0.48, y: 0.4, size: 1.5, drift: -6 },
  { x: 0.27, y: 0.78, size: 2, drift: -10 },
];

export function AnimatedSplashScreen({
  onAnimationComplete,
  isAppReady,
}: AnimatedSplashScreenProps) {
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

  const [minTimePassed, setMinTimePassed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const exited = useRef(false);

  useEffect(() => {
    const min = setTimeout(() => setMinTimePassed(true), MIN_VISIBLE_MS);
    const max = setTimeout(() => {
      if (!exited.current) console.warn("[Splash] Startup took over 15 s; opening anyway");
      setTimedOut(true);
    }, MAX_VISIBLE_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, []);

  useEffect(() => {
    if (exited.current || !minTimePassed || !(isAppReady || timedOut)) return;
    exited.current = true;
    containerOpacity.value = withTiming(0, { duration: 300, easing: Easing.inOut(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onAnimationComplete)();
    });
  }, [minTimePassed, isAppReady, timedOut, onAnimationComplete, containerOpacity]);

  // Entry: background, then the wordmark, tagline and credits, fitted into MIN_VISIBLE_MS.
  useEffect(() => {
    backgroundOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    logoOpacity.value = withDelay(150, withTiming(1, { duration: 450 }));
    logoScale.value = withDelay(150, withSpring(1, { damping: 14, stiffness: 120 }));
    textOpacity.value = withDelay(300, withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }));
    textTranslateY.value = withDelay(300, withSpring(0, { damping: 16, stiffness: 120 }));
    pulseScale.value = withDelay(700, withSequence(withTiming(1.03, { duration: 250 }), withTiming(1, { duration: 250 })));
    particlesOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    particlesDrift.value = withDelay(200, withTiming(-16, { duration: 1200, easing: Easing.out(Easing.quad) }));
    creditsOpacity.value = withDelay(500, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
    // Shared values are stable, so this still runs once.
  }, [backgroundOpacity, creditsOpacity, logoOpacity, logoScale, particlesDrift, particlesOpacity, pulseScale, textOpacity, textTranslateY]);

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
          {getVersionLabel()}
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
