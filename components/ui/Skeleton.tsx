import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  makeMutable,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../theme/theme";
import { alpha, motion, radius as radii, withAlpha } from "../../theme/tokens";

// One clock for every block on screen, so the shimmer moves in sync.
const shimmer = makeMutable(0);
let shimmerUsers = 0;

function useSharedShimmer(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    shimmerUsers += 1;
    if (shimmerUsers === 1) {
      shimmer.value = 0;
      shimmer.value = withRepeat(withTiming(1, { duration: motion.shimmerMs, easing: Easing.linear }), -1, false);
    }
    return () => {
      shimmerUsers -= 1;
      if (shimmerUsers === 0) shimmer.value = 0;
    };
  }, [enabled]);
}

export type SkeletonBlockProps = {
  width?: DimensionValue;
  height?: number;
  radius?: keyof typeof radii;
  style?: StyleProp<ViewStyle>;
};

/** Placeholder block with a shared shimmer; static when reduce-motion is on. */
export function SkeletonBlock({ width = "100%", height = 16, radius = "md", style }: SkeletonBlockProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [blockWidth, setBlockWidth] = useState(0);
  useSharedShimmer(!reduceMotion);

  const band = useAnimatedStyle(() => ({
    transform: [{ translateX: -blockWidth + shimmer.value * blockWidth * 2 }],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setBlockWidth(e.nativeEvent.layout.width)}
      style={[
        { width, height, borderRadius: radii[radius], backgroundColor: colors.surfaceContainerHigh, overflow: "hidden" },
        style,
      ]}
    >
      {!reduceMotion && blockWidth > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, band]}>
          <LinearGradient
            colors={["transparent", withAlpha(colors.text, alpha.shimmer), "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

/** @deprecated use SkeletonBlock */
export const Skeleton = SkeletonBlock;
export type SkeletonProps = SkeletonBlockProps;
