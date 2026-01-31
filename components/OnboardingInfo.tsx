/**
 * OnboardingInfo - Feature Highlights Screen
 * ==========================================
 * Second screen in onboarding showing key features.
 * Premium design with animated cards.
 * 
 * Features:
 * - Feature cards with icons
 * - Smooth staggered animations
 * - Consistent brand styling via theme
 * - "Next" CTA button
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingInfoProps {
  onNext: () => void;
}

interface FeatureCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  delay: number;
}

/**
 * Feature highlight card with icon
 */
function FeatureCard({ icon, title, description, delay }: FeatureCardProps) {
  const { colors } = useTheme();
  
  return (
    <Animated.View 
      entering={FadeInDown.delay(delay).springify()}
      style={[
        cardStyles.container,
        {
          backgroundColor: colors.surfaceGlass,
          borderColor: colors.borderGlass,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            },
            android: { elevation: 4 },
          }),
        }
      ]}
    >
      <View style={cardStyles.iconContainer}>
        <LinearGradient
          colors={[colors.accentDim, "transparent"]}
          style={cardStyles.iconGradient}
        >
          <Ionicons name={icon} size={28} color={colors.accent} />
        </LinearGradient>
      </View>
      <View style={cardStyles.content}>
        <Text style={[cardStyles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[cardStyles.description, { color: colors.textSecondary }]}>{description}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * Progress indicator dots
 */
function ProgressDots({ current, total }: { current: number; total: number }) {
  const { colors } = useTheme();
  
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            { backgroundColor: colors.border },
            i === current && [styles.progressDotActive, { backgroundColor: colors.accent }],
            i < current && { backgroundColor: colors.accent },
          ]}
        />
      ))}
    </View>
  );
}

const FEATURES = [
  {
    icon: "barbell-outline" as const,
    title: "Smart Workout Logging",
    description: "Log exercises, sets, reps, and weights with a beautiful intuitive interface.",
  },
  {
    icon: "analytics-outline" as const,
    title: "Visual Progress Tracking",
    description: "See your strength gains over time with detailed charts and analytics.",
  },
  {
    icon: "body-outline" as const,
    title: "Body Measurements",
    description: "Track weight and body metrics to see your complete transformation.",
  },
  {
    icon: "cloud-outline" as const,
    title: "Cloud Sync",
    description: "Your data is securely backed up and synced across all your devices.",
  },
];

export function OnboardingInfo({ onNext }: OnboardingInfoProps) {
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
    <View style={[styles.container, { paddingTop: insets.top + 20, backgroundColor: colors.background }]}>
      {/* Background gradient */}
      <LinearGradient
        colors={[colors.background, colors.surfaceElevated, colors.background]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Progress indicator */}
      <Animated.View entering={FadeIn.delay(100)}>
        <ProgressDots current={1} total={3} />
      </Animated.View>

      {/* Header */}
      <Animated.View entering={FadeInDown.delay(200)} style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Everything you need{"\n"}to crush your goals
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Powerful features designed for serious lifters
        </Text>
      </Animated.View>

      {/* Feature cards */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.cardsContainer}
        showsVerticalScrollIndicator={false}
      >
        {FEATURES.map((feature, index) => (
          <FeatureCard
            key={feature.title}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
            delay={300 + index * 100}
          />
        ))}
      </ScrollView>

      {/* CTA Button */}
      <Animated.View 
        entering={FadeInUp.delay(700).springify()}
        style={[styles.buttonContainer, { paddingBottom: insets.bottom + 40, backgroundColor: colors.background }]}
      >
        <Pressable
          onPress={onNext}
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
              <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>Next</Text>
              <Ionicons 
                name="arrow-forward" 
                size={20} 
                color={colors.textOnAccent} 
                style={{ marginLeft: 8 }}
              />
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: 16,
  },
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressDotActive: {
    width: 24,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  cardsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  button: {
    borderRadius: 16,
    overflow: "hidden",
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
