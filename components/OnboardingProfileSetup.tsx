/**
 * OnboardingProfileSetup - Minimal Profile Data Collection
 * =========================================================
 * Fast onboarding with minimal required fields.
 * 
 * Features:
 * - Name text input (REQUIRED)
 * - Height ruler with cm/ft toggle (OPTIONAL - can skip)
 * - Fitness goal selector with cards (OPTIONAL)
 * - Beautiful animations
 * - Progress indication (step 2/3)
 * - Quick completion for user retention
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Height ranges
const CM_MIN = 120;
const CM_MAX = 220;
const FT_MIN = 4; // 4'0"
const FT_MAX = 7; // 7'3"

type Unit = "cm" | "ft";
type FitnessGoal = "strength" | "muscle" | "endurance" | "weight-loss" | "general";

interface FitnessGoalOption {
  id: FitnessGoal;
  label: string;
  emoji: string;
  description: string;
}

const FITNESS_GOALS: FitnessGoalOption[] = [
  { id: "strength", label: "Strength", emoji: "🏋️", description: "Build raw power" },
  { id: "muscle", label: "Muscle Gain", emoji: "💪", description: "Grow bigger muscles" },
  { id: "endurance", label: "Endurance", emoji: "🏃", description: "Improve stamina" },
  { id: "weight-loss", label: "Weight Loss", emoji: "⚖️", description: "Shed pounds" },
  { id: "general", label: "General Fitness", emoji: "🎯", description: "Overall health" },
];

interface OnboardingProfileSetupProps {
  onComplete: (
    name: string,
    age: number | null,
    workoutPlan: FitnessGoal,
    heightCm: number | null,
    weightKg: number | null
  ) => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

/**
 * Generate height values for the ruler
 */
function generateHeightValues(unit: Unit): number[] {
  if (unit === "cm") {
    return Array.from({ length: CM_MAX - CM_MIN + 1 }, (_, i) => CM_MIN + i);
  } else {
    const values: number[] = [];
    for (let ft = FT_MIN; ft <= FT_MAX; ft++) {
      const maxInch = ft === FT_MAX ? 3 : 11;
      for (let inch = 0; inch <= maxInch; inch++) {
        values.push(ft * 12 + inch);
      }
    }
    return values;
  }
}

/**
 * Convert cm to feet/inches display
 */
function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inch = Math.round(totalInches % 12);
  return { ft, inch };
}

/**
 * Convert total inches to cm
 */
function inchesToCm(totalInches: number): number {
  return Math.round(totalInches * 2.54);
}

/**
 * Ruler tick mark component
 */
function RulerTick({
  value,
  unit,
  isSelected,
}: {
  value: number;
  unit: Unit;
  isSelected: boolean;
}) {
  const { colors } = useTheme();
  const isMajor = unit === "cm" ? value % 10 === 0 : value % 12 === 0;
  const isMinor = unit === "cm" ? value % 5 === 0 : true;

  const displayValue =
    unit === "cm"
      ? isMajor
        ? `${value}`
        : ""
      : value % 12 === 0
        ? `${Math.floor(value / 12)}'`
        : "";

  return (
    <View style={tickStyles.tickContainer}>
      <View
        style={[
          tickStyles.tickLine,
          { backgroundColor: colors.textMuted },
          isMajor && [tickStyles.tickMajor, { backgroundColor: colors.textPrimary }],
          !isMajor && isMinor && tickStyles.tickMinor,
          !isMajor && !isMinor && tickStyles.tickSmall,
          isSelected && [tickStyles.tickSelected, { backgroundColor: colors.accent }],
        ]}
      />
      {displayValue ? (
        <Text
          style={[
            tickStyles.tickLabel,
            { color: colors.textMuted },
            isSelected && [tickStyles.tickLabelSelected, { color: colors.accent }]
          ]}
        >
          {displayValue}
        </Text>
      ) : null}
    </View>
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

export function OnboardingProfileSetup({
  onComplete,
  showBackButton = false,
  onBack,
}: OnboardingProfileSetupProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<ScrollView>(null);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [showPersonalizationSection, setShowPersonalizationSection] = useState(false);
  const [unit, setUnit] = useState<Unit>("cm");
  const [selectedHeight, setSelectedHeight] = useState(170);
  const [selectedWeight, setSelectedWeight] = useState<number | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<FitnessGoal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);

  const heightValues = generateHeightValues(unit);
  const ITEM_HEIGHT = 12;
  const toggleProgress = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  const handleBack = () => {
    if (onBack) {
      onBack();
    }
  };

  const handleUnitToggle = (newUnit: Unit) => {
    if (newUnit === unit) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let newHeight: number;
    if (newUnit === "ft") {
      const { ft, inch } = cmToFtIn(selectedHeight);
      newHeight = ft * 12 + inch;
    } else {
      newHeight = inchesToCm(selectedHeight);
    }

    setSelectedHeight(newHeight);
    setUnit(newUnit);
    toggleProgress.value = withSpring(newUnit === "ft" ? 1 : 0);

    // ✅ Adjust scroll position to show equivalent height in new unit
    // Prevents scroll position from feeling stuck or jerky
    const newHeightValues = generateHeightValues(newUnit);
    const newIndex = newHeightValues.indexOf(newHeight);
    if (newIndex !== -1 && flatListRef.current) {
      // Use setTimeout to let state update complete first
      setTimeout(() => {
        flatListRef.current?.scrollTo({
          y: newIndex * ITEM_HEIGHT,
          animated: false, // instant adjustment, not animated
        });
      }, 50);
    }
  };

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const newValue = heightValues[Math.min(index, heightValues.length - 1)];

      if (newValue !== selectedHeight) {
        setSelectedHeight(newValue);
        Haptics.selectionAsync();
      }
    },
    [heightValues, selectedHeight, ITEM_HEIGHT]
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      // Snap to nearest item for better UX
      flatListRef.current?.scrollTo({
        y: index * ITEM_HEIGHT,
        animated: true,
      });
    },
    [ITEM_HEIGHT]
  );

  const handleComplete = async () => {
    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Please enter your name");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (trimmedName.length < 2) {
      setNameError("Name must be at least 2 characters");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Validate age
    const ageNum = parseInt(age, 10);
    if (!age || isNaN(ageNum)) {
      setAgeError("Please enter your age");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (ageNum < 13) {
      setAgeError("You must be at least 13 years old");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (ageNum > 120) {
      setAgeError("Please enter a valid age");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Validate fitness goal (mandatory in V1.1.1)
    if (!selectedGoal) {
      setGoalError("Please select a fitness goal");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      setIsLoading(true);
      buttonScale.value = withSpring(0.96);

      // Height is optional
      const heightCm = showPersonalizationSection && selectedHeight
        ? unit === "cm"
          ? selectedHeight
          : inchesToCm(selectedHeight)
        : null;

      // Weight is optional
      const weightKg = selectedWeight || null;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Delay slightly for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 200));

      onComplete(trimmedName, ageNum, selectedGoal, heightCm, weightKg);
    } finally {
      setIsLoading(false);
      buttonScale.value = withSpring(1);
    }
  };

  const displayHeight =
    unit === "cm"
      ? `${selectedHeight} cm`
      : (() => {
          const { ft, inch } = cmToFtIn(selectedHeight);
          return `${ft}'${inch}"`;
        })();

  const toggleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(toggleProgress.value, [0, 1], [0, 87]) }],
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 12}
    >
      <LinearGradient
        colors={[colors.background, colors.surfaceElevated, colors.background]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.lg }}>
          {showBackButton && (
            <Pressable
              onPress={handleBack}
              style={{ marginRight: spacing.md, padding: spacing.xs }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <ProgressDots current={2} total={3} />
          </View>
        </View>

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(100)}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Let's Get to Know You
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Complete your profile to personalize your experience
          </Text>
        </Animated.View>

        {/* Name Input Section */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.surface,
                borderColor: nameError ? colors.error : colors.cardBorder,
              },
            ]}
          >
            <Text style={[styles.label, { color: colors.textMuted }]}>
              FULL NAME *
            </Text>
            <TextInput
              placeholder="Enter your name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError(null);
              }}
              maxLength={50}
              style={[
                styles.nameInput,
                {
                  backgroundColor: colors.surfaceElevated,
                  color: colors.textPrimary,
                  borderColor: nameError ? colors.error : "transparent",
                },
              ]}
            />
            {nameError && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.xs }}>
                <Ionicons
                  name="alert-circle"
                  size={14}
                  color={colors.error}
                  style={{ marginRight: spacing.xs }}
                />
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {nameError}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Age Input Section */}
        <Animated.View entering={FadeInUp.delay(250).duration(400)}>
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.surface,
                borderColor: ageError ? colors.error : colors.cardBorder,
              },
            ]}
          >
            <Text style={[styles.label, { color: colors.textMuted }]}>
              AGE * 
              <Text style={{ fontSize: 12, fontWeight: "400" }}>
                {" "}
              </Text>
            </Text>
            <TextInput
              placeholder="Enter your age"
              placeholderTextColor={colors.textMuted}
              value={age}
              onChangeText={(text) => {
                setAge(text);
                if (ageError) setAgeError(null);
              }}
              maxLength={3}
              keyboardType="number-pad"
              style={[
                styles.nameInput,
                {
                  backgroundColor: colors.surfaceElevated,
                  color: colors.textPrimary,
                  borderColor: ageError ? colors.error : "transparent",
                },
              ]}
            />
            {ageError && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.xs }}>
                <Ionicons
                  name="alert-circle"
                  size={14}
                  color={colors.error}
                  style={{ marginRight: spacing.xs }}
                />
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {ageError}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Personalization Section (Height & Weight) - Optional */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          {!showPersonalizationSection ? (
            <Pressable
              onPress={() => setShowPersonalizationSection(true)}
              style={[
                styles.section,
                {
                  backgroundColor: colors.accentLight,
                  borderColor: colors.accent + "30",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.accent, marginBottom: 6 }]}>
                  PERSONALIZATION (OPTIONAL)
                </Text>
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                  Tap to add height & weight for better recommendations
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.accent} />
            </Pressable>
          ) : (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  HEIGHT
                </Text>

                {/* Unit Toggle */}
                <View
                  style={[
                    styles.unitToggle,
                    { backgroundColor: colors.surfaceElevated },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.unitToggleBackground,
                      {
                        backgroundColor: colors.accent,
                      },
                      toggleStyle,
                    ]}
                  />
                  <Pressable
                    onPress={() => handleUnitToggle("cm")}
                    style={{ flex: 1, alignItems: "center", zIndex: 1 }}
                  >
                    <Text
                      style={[
                        styles.unitToggleText,
                        {
                          color: unit === "cm" ? "#fff" : colors.textSecondary,
                          fontWeight: unit === "cm" ? "700" : "500",
                        },
                      ]}
                    >
                      cm
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleUnitToggle("ft")}
                    style={{ flex: 1, alignItems: "center", zIndex: 1 }}
                  >
                    <Text
                      style={[
                        styles.unitToggleText,
                        {
                          color: unit === "ft" ? "#fff" : colors.textSecondary,
                          fontWeight: unit === "ft" ? "700" : "500",
                        },
                      ]}
                    >
                      ft/in
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Height Display */}
              <View
                style={[
                  styles.heightDisplay,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <Ionicons
                  name="resize-outline"
                  size={20}
                  color={colors.accent}
                  style={{ marginRight: spacing.sm }}
                />
                <Text style={[styles.heightValue, { color: colors.textPrimary }]}>
                  {unit === "cm"
                    ? `${selectedHeight} cm`
                    : (() => {
                        const { ft, inch } = cmToFtIn(selectedHeight);
                        return `${ft}'${inch}"`;
                      })()}
                </Text>
              </View>

              {/* Height Ruler */}
              <View style={[styles.rulerBorder, { borderColor: colors.cardBorder }]}>
                <ScrollView
                  ref={flatListRef}
                  style={[styles.rulerContainer, { height: 180 }]}
                  contentContainerStyle={{ paddingVertical: 70 }}
                  scrollEventThrottle={16}
                  onScroll={handleScroll}
                  onMomentumScrollEnd={handleMomentumScrollEnd}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                >
                  {heightValues.map((item, index) => (
                    <RulerTick
                      key={`${item}-${index}`}
                      value={item}
                      unit={unit}
                      isSelected={item === selectedHeight}
                    />
                  ))}
                </ScrollView>
              </View>

              {/* Weight Input */}
              <View
                style={[{
                  marginTop: spacing.lg,
                  paddingTop: spacing.lg,
                  borderTopWidth: 1,
                  borderTopColor: colors.cardBorder,
                }]}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  WEIGHT (KG) - OPTIONAL
                </Text>
                <TextInput
                  placeholder="Enter your weight in kg"
                  placeholderTextColor={colors.textMuted}
                  value={selectedWeight ? selectedWeight.toString() : ""}
                  onChangeText={(text) => {
                    const weight = text ? parseInt(text, 10) : null;
                    if (!text || (weight !== null && !isNaN(weight) && weight > 0 && weight < 500)) {
                      setSelectedWeight(weight);
                    }
                  }}
                  maxLength={3}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: colors.surfaceElevated,
                    color: colors.textPrimary,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    padding: spacing.md,
                    fontSize: typography.body.fontSize,
                    marginTop: spacing.sm,
                  }}
                />
              </View>

              <Pressable
                onPress={() => setShowPersonalizationSection(false)}
                style={[styles.skipButton, { borderColor: colors.textMuted }]}
              >
                <Text style={[styles.skipButtonText, { color: colors.textMuted }]}>
                  Skip for now
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* Fitness Goal Section - MANDATORY in V1.1.1 */}
        <Animated.View entering={FadeInUp.delay(350).duration(400)}>
          <View
            style={{
              backgroundColor: goalError ? colors.errorLight || colors.error + "20" : "transparent",
              borderRadius: radius.lg,
              padding: goalError ? spacing.sm : 0,
              marginBottom: goalError ? spacing.sm : 0,
            }}
          >
            <Text style={[styles.label, { color: colors.textMuted, marginVertical: spacing.md }]}>
              YOUR FITNESS GOAL *
            </Text>
            {goalError && (
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
                <Ionicons
                  name="alert-circle"
                  size={14}
                  color={colors.error}
                  style={{ marginRight: spacing.xs }}
                />
                <Text style={{ color: colors.error, fontSize: 12, flex: 1 }}>
                  {goalError}
                </Text>
              </View>
            )}
          </View>
          <View style={{ gap: spacing.sm }}>
            {FITNESS_GOALS.map((goal) => (
              <Pressable
                key={goal.id}
                onPress={() => {
                  setSelectedGoal(goal.id);
                  setGoalError(null); // Clear error when user selects
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.goalCard,
                  {
                    backgroundColor: selectedGoal === goal.id ? colors.accentLight : colors.surface,
                    borderColor: selectedGoal === goal.id ? colors.accent : colors.cardBorder,
                  },
                ]}
              >
                <Text style={{ fontSize: 24, marginRight: spacing.md }}>
                  {goal.emoji}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.goalLabel,
                      {
                        color:
                          selectedGoal === goal.id ? colors.accent : colors.textPrimary,
                      },
                    ]}
                  >
                    {goal.label}
                  </Text>
                  <Text
                    style={[
                      styles.goalDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {goal.description}
                  </Text>
                </View>
                {selectedGoal === goal.id && (
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: colors.accent,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Complete Button */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(400)}
        style={[
          styles.buttonContainer,
          { paddingBottom: insets.bottom + spacing.lg, backgroundColor: colors.background },
        ]}
      >
        <Animated.View style={buttonAnimStyle}>
          <Pressable
            onPress={handleComplete}
            disabled={isLoading}
            style={[
              styles.button,
              {
                backgroundColor: colors.accent,
                opacity: isLoading ? 0.7 : 1,
              },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={[styles.buttonText, { color: "#fff" }]}>
                  Complete Setup
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="#fff"
                  style={{ marginLeft: spacing.xs }}
                />
              </>
            )}
          </Pressable>
        </Animated.View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const tickStyles = StyleSheet.create({
  tickContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 12,
    marginVertical: 0,
  },
  tickLine: {
    width: 20,
    height: 2,
    marginRight: 8,
  },
  tickMajor: {
    height: 3,
    width: 30,
  },
  tickMinor: {
    width: 20,
  },
  tickSmall: {
    width: 10,
  },
  tickSelected: {
    height: 3,
  },
  tickLabel: {
    fontSize: 12,
    marginLeft: 8,
    width: 30,
  },
  tickLabelSelected: {
    fontWeight: "600",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 10,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressDotActive: {
    width: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  nameInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  unitToggle: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    position: "relative",
    overflow: "hidden",
    height: 36,
    backgroundColor: "transparent",
    minWidth: 180, // Fixed width for predictable sizing
  },
  unitToggleBackground: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 3,
    width: 84, // Fixed width: (180 - 3*2) / 2 = 87, minus padding
    borderRadius: 8,
  },
  unitToggleText: {
    fontSize: 13,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontWeight: "600",
  },
  heightDisplay: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  heightValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  rulerContainer: {
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  rulerBorder: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  skipButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  goalCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  goalDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  buttonContainer: {
    padding: 20,
    paddingTop: 12,
  },
  button: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
