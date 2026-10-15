import { useEffect, type ReactNode } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { motion } from "../../theme/tokens";

export type RevealProps = {
  /** Position in the screen's stack of cards; each step starts a little later. */
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Layout of the revealed block in its parent (e.g. for scroll-to-field). */
  onLayout?: (e: LayoutChangeEvent) => void;
};

/**
 * Card entrance: rises a few pixels and fades in, staggered by `index`, once
 * when it mounts. Runs on the UI thread (Reanimated shared values), so it stays
 * smooth while the JS thread renders.
 *
 * Deliberately a plain animated transform, not a Reanimated `entering` layout
 * animation: on Android (new architecture) those could leave buttons inside
 * only partly tappable. Respects the system "reduce motion" setting.
 */
export function Reveal({ index = 0, children, style, onLayout }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    const delay = Math.min(index, motion.revealMaxSteps) * motion.revealStaggerMs;
    progress.value = withDelay(delay, withTiming(1, { duration: motion.revealMs, easing: Easing.out(Easing.cubic) }));
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * motion.revealOffset }],
  }));

  return (
    <Animated.View onLayout={onLayout} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}
