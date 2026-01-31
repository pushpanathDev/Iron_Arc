/**
 * HeightPickerScreen - Premium Onboarding
 * ========================================
 * Beautiful height selection with vertical ruler UI.
 * Uses theme system for consistent styling.
 * 
 * Features:
 * - cm/ft toggle switch
 * - Vertical ruler with smooth scrolling
 * - Current value highlight
 * - Haptic feedback on selection
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
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

interface HeightPickerScreenProps {
  onComplete: (heightCm: number) => void;
  initialHeight?: number;
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
    // Generate feet + inches (4'0" to 7'3")
    const values: number[] = [];
    for (let ft = FT_MIN; ft <= FT_MAX; ft++) {
      const maxInch = ft === FT_MAX ? 3 : 11;
      for (let inch = 0; inch <= maxInch; inch++) {
        values.push(ft * 12 + inch); // Store as total inches
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
    <View style={progressStyles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            progressStyles.dot,
            { backgroundColor: colors.border },
            i === current && [progressStyles.dotActive, { backgroundColor: colors.accent }],
            i < current && { backgroundColor: colors.accent },
          ]}
        />
      ))}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
  },
});

const tickStyles = StyleSheet.create({
  tickContainer: {
    height: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  tickLine: {
    height: 1,
  },
  tickMajor: {
    width: 30,
    height: 2,
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

export function HeightPickerScreen({
  onComplete,
  initialHeight = 170,
  showBackButton = false,
  onBack,
}: HeightPickerScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const [unit, setUnit] = useState<Unit>("cm");
  const [selectedValue, setSelectedValue] = useState(
    unit === "cm" ? initialHeight : Math.round(initialHeight / 2.54)
  );

  const heightValues = generateHeightValues(unit);
  const ITEM_HEIGHT = 12;

  // Animation for toggle
  const toggleProgress = useSharedValue(0);

  const handleUnitToggle = (newUnit: Unit) => {
    if (newUnit === unit) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Convert current value
    if (newUnit === "ft") {
      const { ft, inch } = cmToFtIn(selectedValue);
      setSelectedValue(ft * 12 + inch);
    } else {
      setSelectedValue(inchesToCm(selectedValue));
    }

    setUnit(newUnit);
    toggleProgress.value = withSpring(newUnit === "ft" ? 1 : 0);
  };

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const newValue = heightValues[Math.min(index, heightValues.length - 1)];

      if (newValue !== selectedValue) {
        setSelectedValue(newValue);
        Haptics.selectionAsync();
      }
    },
    [heightValues, selectedValue, ITEM_HEIGHT]
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      flatListRef.current?.scrollToOffset({
        offset: index * ITEM_HEIGHT,
        animated: true,
      });
    },
    [ITEM_HEIGHT]
  );

  const handleNext = () => {
    const heightCm = unit === "cm" ? selectedValue : inchesToCm(selectedValue);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(heightCm);
  };

  // Current display value
  const displayValue =
    unit === "cm"
      ? `${selectedValue} cm`
      : `${Math.floor(selectedValue / 12)}' ${selectedValue % 12}"`;

  // Toggle indicator style
  const toggleIndicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(toggleProgress.value, [0, 1], [0, 60]),
      },
    ],
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, backgroundColor: colors.background }]}>
      {/* Background gradient */}
      <LinearGradient
        colors={[colors.background, colors.surfaceElevated, colors.background]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Progress dots (when in onboarding flow) */}
      {showBackButton && (
        <Animated.View entering={FadeIn.delay(100)}>
          <ProgressDots current={2} total={3} />
        </Animated.View>
      )}

      {/* Back button */}
      {showBackButton && (
        <Animated.View entering={FadeIn.delay(100)}>
          <Pressable 
            style={[styles.backButton, { backgroundColor: colors.surfaceGlass, borderColor: colors.borderGlass }]} 
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
        </Animated.View>
      )}

      {/* Header */}
      <Animated.View entering={FadeInDown.delay(200)} style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>What is your height?</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Height helps personalize workouts and track{"\n"}fitness progress accurately.
        </Text>
      </Animated.View>

      {/* Unit toggle */}
      <Animated.View entering={FadeInDown.delay(300)} style={styles.toggleContainer}>
        <View style={[styles.toggleBackground, { backgroundColor: colors.surfaceGlass, borderColor: colors.borderGlass }]}>
          <Animated.View style={[styles.toggleIndicator, toggleIndicatorStyle, { backgroundColor: colors.accent }]} />
          <Pressable
            style={styles.toggleOption}
            onPress={() => handleUnitToggle("cm")}
          >
            <Text
              style={[
                styles.toggleText,
                { color: colors.textMuted },
                unit === "cm" && [styles.toggleTextActive, { color: colors.textOnAccent }],
              ]}
            >
              cm
            </Text>
          </Pressable>
          <Pressable
            style={styles.toggleOption}
            onPress={() => handleUnitToggle("ft")}
          >
            <Text
              style={[
                styles.toggleText,
                { color: colors.textMuted },
                unit === "ft" && [styles.toggleTextActive, { color: colors.textOnAccent }],
              ]}
            >
              ft
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Height picker area */}
      <Animated.View entering={FadeInDown.delay(400)} style={styles.pickerArea}>
        {/* Current value display */}
        <View style={styles.valueDisplay}>
          <Text style={[styles.valueText, { color: colors.textPrimary }]}>{displayValue}</Text>
          <View style={[styles.valueLine, { backgroundColor: colors.accent }]} />
        </View>

        {/* Ruler */}
        <View style={styles.rulerContainer}>
          <FlatList
            ref={flatListRef}
            data={heightValues}
            keyExtractor={(item) => item.toString()}
            renderItem={({ item }) => (
              <RulerTick
                value={item}
                unit={unit}
                isSelected={item === selectedValue}
              />
            )}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onScroll={handleScroll}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingVertical: SCREEN_HEIGHT * 0.2,
            }}
            getItemLayout={(_, index) => ({
              length: ITEM_HEIGHT,
              offset: ITEM_HEIGHT * index,
              index,
            })}
            initialScrollIndex={Math.max(
              0,
              heightValues.indexOf(selectedValue) - 5
            )}
          />

          {/* Ruler scale on right */}
          <View style={[styles.rulerScale, { backgroundColor: colors.surfaceGlass }]}>
            {Array.from({ length: 10 }).map((_, i) => (
              <View key={i} style={[styles.scaleTick, { backgroundColor: colors.textMuted }]} />
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Next button */}
      <Animated.View
        entering={FadeInDown.delay(500)}
        style={[styles.buttonContainer, { paddingBottom: insets.bottom + 20 }]}
      >
        <Pressable 
          style={[
            styles.nextButton,
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
          ]} 
          onPress={handleNext}
        >
          <LinearGradient
            colors={[colors.accent, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Text style={[styles.nextButtonText, { color: colors.textOnAccent }]}>Continue</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 20,
    marginBottom: 20,
    borderWidth: 1,
  },

  header: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },

  toggleContainer: {
    alignItems: "center",
    marginBottom: 32,
  },

  toggleBackground: {
    flexDirection: "row",
    borderRadius: 25,
    padding: 4,
    borderWidth: 1,
  },

  toggleIndicator: {
    position: "absolute",
    width: 60,
    height: 42,
    borderRadius: 21,
    top: 4,
    left: 4,
  },

  toggleOption: {
    width: 60,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
  },

  toggleText: {
    fontSize: 16,
    fontWeight: "600",
  },

  toggleTextActive: {},

  pickerArea: {
    flex: 1,
    flexDirection: "row",
  },

  valueDisplay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 24,
  },

  valueText: {
    fontSize: 48,
    fontWeight: "700",
  },

  valueLine: {
    width: 80,
    height: 3,
    borderRadius: 1.5,
    marginTop: 8,
  },

  rulerContainer: {
    width: 80,
    flexDirection: "row",
  },

  rulerScale: {
    width: 2,
    marginLeft: 8,
    justifyContent: "space-between",
    paddingVertical: 40,
    borderRadius: 1,
  },

  scaleTick: {
    width: 8,
    height: 1,
  },

  buttonContainer: {
    paddingHorizontal: 24,
  },

  nextButton: {
    borderRadius: 30,
    overflow: "hidden",
  },

  buttonGradient: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },

  nextButtonText: {
    fontSize: 18,
    fontWeight: "700",
  },
});

export default HeightPickerScreen;
