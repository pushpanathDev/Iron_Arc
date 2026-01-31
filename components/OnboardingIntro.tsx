/**
 * OnboardingIntro - Welcome Screen
 * =================================
 * Premium animated intro with gym man illustration.
 * First screen in the onboarding flow.
 * 
 * Features:
 * - Animated weightlifter illustration
 * - Brand styling with theme colors
 * - Smooth entrance animations
 * - "Get Started" CTA button
 */

import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface OnboardingIntroProps {
  onStart: () => void;
}

/**
 * Animated Weightlifter Illustration
 * A stylized figure doing an overhead press with powerful animations
 */
function AnimatedWeightlifter() {
  const { colors } = useTheme();
  const liftProgress = useSharedValue(0);
  const bodyPulse = useSharedValue(1);
  const glowPulse = useSharedValue(0.3);
  const muscleFlexPulse = useSharedValue(1);

  useEffect(() => {
    // Overhead press animation - powerful lift motion
    liftProgress.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.2)) }), // Push up powerfully
          withTiming(1, { duration: 400 }), // Hold at top
          withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) }) // Lower down
        ),
        -1,
        false
      )
    );

    // Body breathing - more pronounced during lift
    bodyPulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 600 }),
        withTiming(1, { duration: 900 })
      ),
      -1,
      true
    );

    // Muscle flex pulse for emphasis
    muscleFlexPulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 300 }),
        withTiming(1, { duration: 300 })
      ),
      -1,
      true
    );

    // Glow pulse - intense during lift
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 600 }),
        withTiming(0.25, { duration: 900 })
      ),
      -1,
      true
    );
  }, []);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bodyPulse.value }],
  }));

  // Arms move up during lift (overhead press)
  const armStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(liftProgress.value, [0, 1], [0, -60]) },
    ],
  }));

  // Barbell moves up with arms
  const barbellStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(liftProgress.value, [0, 1], [0, -60]) },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value,
    transform: [{ scale: interpolate(liftProgress.value, [0, 1], [1, 1.15]) }],
  }));

  // Muscles flex during lift
  const muscleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: muscleFlexPulse.value }],
  }));

  // Figure color - use accent for premium feel
  const figureColor = colors.accent;
  const barbellColor = colors.textPrimary;

  return (
    <View style={illustrationStyles.container}>
      {/* Background glow */}
      <Animated.View 
        style={[
          illustrationStyles.glow, 
          glowStyle,
          { backgroundColor: colors.accent }
        ]} 
      />
      
      {/* Main figure */}
      <Animated.View style={[illustrationStyles.figure, bodyStyle]}>
        {/* Head */}
        <View style={[illustrationStyles.head, { backgroundColor: figureColor }]} />
        
        {/* Torso */}
        <View style={[illustrationStyles.torso, { backgroundColor: figureColor }]}>
          {/* Shoulder line */}
          <View style={[illustrationStyles.shoulders, { backgroundColor: figureColor }]} />
        </View>
        
        {/* Arms with barbell */}
        <Animated.View style={[illustrationStyles.armsContainer, armStyle]}>
          {/* Left arm */}
          <View style={illustrationStyles.arm}>
            <View style={[illustrationStyles.bicep, { backgroundColor: figureColor }]} />
            <View style={[illustrationStyles.forearm, { backgroundColor: figureColor }]} />
          </View>
          
          {/* Barbell */}
          <Animated.View style={[illustrationStyles.barbell, barbellStyle]}>
            {/* Left weight */}
            <View style={[illustrationStyles.weight, illustrationStyles.weightLeft, { backgroundColor: barbellColor }]}>
              <View style={[illustrationStyles.weightInner, { backgroundColor: colors.textMuted }]} />
            </View>
            {/* Bar */}
            <View style={[illustrationStyles.bar, { backgroundColor: barbellColor }]} />
            {/* Right weight */}
            <View style={[illustrationStyles.weight, illustrationStyles.weightRight, { backgroundColor: barbellColor }]}>
              <View style={[illustrationStyles.weightInner, { backgroundColor: colors.textMuted }]} />
            </View>
          </Animated.View>
          
          {/* Right arm */}
          <View style={[illustrationStyles.arm, illustrationStyles.armRight]}>
            <View style={[illustrationStyles.bicep, { backgroundColor: figureColor }]} />
            <View style={[illustrationStyles.forearm, { backgroundColor: figureColor }]} />
          </View>
        </Animated.View>
        
        {/* Legs */}
        <View style={illustrationStyles.legsContainer}>
          <View style={[illustrationStyles.leg, { backgroundColor: figureColor }]} />
          <View style={[illustrationStyles.leg, illustrationStyles.legRight, { backgroundColor: figureColor }]} />
        </View>
      </Animated.View>
      
      {/* Ground reflection */}
      <View style={[illustrationStyles.groundReflection, { backgroundColor: colors.accent }]} />
    </View>
  );
}

/**
 * Feature bullet point
 */
function FeatureBullet({ text, delay }: { text: string; delay: number }) {
  const { colors } = useTheme();
  
  return (
    <Animated.View 
      entering={FadeInUp.delay(delay).springify()}
      style={styles.bulletContainer}
    >
      <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
      <Text style={[styles.bulletText, { color: colors.textPrimary }]}>{text}</Text>
    </Animated.View>
  );
}

export function OnboardingIntro({ onStart }: OnboardingIntroProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const buttonScale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    buttonScale.value = withSpring(0.96);
  }, []);

  const handlePressOut = useCallback(() => {
    buttonScale.value = withSpring(1);
  }, []);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Subtle background gradient */}
      <LinearGradient
        colors={[colors.background, colors.surfaceElevated, colors.background]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated illustration */}
      <Animated.View 
        entering={FadeIn.delay(200).duration(800)}
        style={styles.illustrationContainer}
      >
        <AnimatedWeightlifter />
      </Animated.View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>Welcome to</Text>
          <Text style={[styles.brandName, { color: colors.textPrimary }]}>
            <Text style={{ color: colors.accent }}>IRON</Text> ARC
          </Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.Text 
          entering={FadeInDown.delay(500).springify()}
          style={[styles.tagline, { color: colors.textSecondary }]}
        >
          Forge Your Strength Journey
        </Animated.Text>

        {/* Feature bullets */}
        <View style={styles.features}>
          <FeatureBullet text="Track workouts effortlessly" delay={600} />
          <FeatureBullet text="Monitor your progress" delay={700} />
          <FeatureBullet text="Achieve your goals" delay={800} />
        </View>
      </View>

      {/* CTA Button */}
      <Animated.View 
        entering={FadeInUp.delay(900).springify()}
        style={[styles.buttonContainer, { paddingBottom: insets.bottom + 40 }]}
      >
        <Pressable
          onPress={onStart}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Animated.View style={[
            styles.button, 
            buttonStyle,
            {
              ...Platform.select({
                ios: {
                  shadowColor: colors.accent,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                },
                android: { elevation: 8 },
              }),
            }
          ]}>
            <LinearGradient
              colors={[colors.accent, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>Get Started</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const illustrationStyles = StyleSheet.create({
  container: {
    width: 200,
    height: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.2,
  },
  figure: {
    alignItems: "center",
  },
  head: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 6,
  },
  torso: {
    width: 50,
    height: 70,
    borderRadius: 8,
    alignItems: "center",
  },
  shoulders: {
    position: "absolute",
    top: 0,
    width: 70,
    height: 14,
    borderRadius: 7,
  },
  armsContainer: {
    position: "absolute",
    top: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  arm: {
    alignItems: "center",
    marginHorizontal: 30,
  },
  armRight: {
    transform: [{ scaleX: -1 }],
  },
  bicep: {
    width: 14,
    height: 35,
    borderRadius: 7,
  },
  forearm: {
    width: 12,
    height: 30,
    borderRadius: 6,
    marginTop: -5,
  },
  barbell: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    top: 45,
  },
  bar: {
    width: 120,
    height: 8,
    borderRadius: 4,
  },
  weight: {
    width: 20,
    height: 50,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  weightLeft: {
    marginRight: -5,
  },
  weightRight: {
    marginLeft: -5,
  },
  weightInner: {
    width: 14,
    height: 40,
    borderRadius: 3,
    opacity: 0.4,
  },
  legsContainer: {
    flexDirection: "row",
    marginTop: 4,
  },
  leg: {
    width: 18,
    height: 80,
    borderRadius: 9,
    marginHorizontal: 4,
  },
  legRight: {},
  groundReflection: {
    position: "absolute",
    bottom: -20,
    width: 100,
    height: 20,
    opacity: 0.15,
    borderRadius: 50,
    transform: [{ scaleY: 0.3 }],
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  illustrationContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  content: {
    paddingHorizontal: 32,
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 4,
  },
  brandName: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: 6,
    textAlign: "center",
  },
  tagline: {
    fontSize: 16,
    marginTop: 12,
    textAlign: "center",
  },
  features: {
    marginTop: 32,
    alignSelf: "stretch",
    paddingHorizontal: 20,
  },
  bulletContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 14,
  },
  bulletText: {
    fontSize: 16,
    fontWeight: "500",
  },
  buttonContainer: {
    paddingHorizontal: 32,
    marginTop: 40,
  },
  button: {
    borderRadius: 16,
    overflow: "hidden",
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
