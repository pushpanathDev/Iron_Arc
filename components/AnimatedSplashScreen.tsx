/**
 * AnimatedSplashScreen - Iron Arc Edition
 * ========================================
 * Clean, professional splash screen with logo animation.
 * Uses the actual app logo with smooth scale and fade animations.
 */

import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
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

const SPLASH_ANIMATION_MS = 4500;

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

  // Track animation completion
  const [animationDone, setAnimationDone] = useState(false);

  // Log splash state for debugging
  useEffect(() => {
    console.log("[Splash] Mounted, isAppReady:", isAppReady);
  }, []);

  useEffect(() => {
    console.log(
      "[Splash] State - isAppReady:",
      isAppReady,
      "animationDone:",
      animationDone,
    );
  }, [isAppReady, animationDone]);

  // Failsafe in case Lottie doesn't fire completion
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!animationDone) {
        console.log("[Splash] Animation timeout fallback");
        setAnimationDone(true);
      }
    }, SPLASH_ANIMATION_MS + 800);

    return () => clearTimeout(timer);
  }, [animationDone]);

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

  // Exit animation when app is ready AND splash animation finished
  useEffect(() => {
    // Wait for BOTH conditions: app ready AND animation finish
    if (!isAppReady || !animationDone || hasExited.current) {
      console.log(
        "[Splash] Not ready to exit - isAppReady:",
        isAppReady,
        "animationDone:",
        animationDone,
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
  }, [isAppReady, animationDone, onAnimationComplete]);

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

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <LinearGradient
        colors={["#0B1220", "#0F172A", "#101B2F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      <View style={styles.glowTopLeft} />
      <View style={styles.glowBottomRight} />

      <View style={styles.topAccent} />

      {/* Cinematic Lottie Animation */}
      <View style={styles.lottieContainer}>
        <LottieView
          source={require("../assets/animations/hero-lift.json")}
          autoPlay
          loop={false}
          onAnimationFinish={() => {
            console.log("[Splash] Lottie finished");
            setAnimationDone(true);
          }}
          style={styles.lottie}
        />
      </View>

      {/* Logo + Halo (subtle brand) */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Animated.View style={[styles.logoHalo, haloStyle]} />
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
    backgroundColor: "#0B1220",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  glowTopLeft: {
    position: "absolute",
    width: SCREEN_WIDTH * 1.1,
    height: SCREEN_WIDTH * 1.1,
    borderRadius: SCREEN_WIDTH * 0.55,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    top: -SCREEN_WIDTH * 0.45,
    left: -SCREEN_WIDTH * 0.35,
  },
  glowBottomRight: {
    position: "absolute",
    width: SCREEN_WIDTH * 1.3,
    height: SCREEN_WIDTH * 1.3,
    borderRadius: SCREEN_WIDTH * 0.65,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    bottom: -SCREEN_WIDTH * 0.5,
    right: -SCREEN_WIDTH * 0.4,
  },
  topAccent: {
    position: "absolute",
    top: 0,
    width: "100%",
    height: 3,
    backgroundColor: "rgba(16, 185, 129, 0.8)",
  },
  logoContainer: {
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  lottieContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.55,
    justifyContent: "center",
    alignItems: "center",
  },
  lottie: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.5,
  },
  logoHalo: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    shadowColor: "#10B981",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
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
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 12,
    marginBottom: 2,
  },
  arcText: {
    fontSize: 46,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 16,
  },
  tagline: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
    letterSpacing: 3,
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
