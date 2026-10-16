import { useEffect } from "react";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { motion, size } from "../../theme/tokens";

/**
 * Short horizontal slide when switching exercises. A plain animated transform
 * rather than a Reanimated `entering` layout animation: on Android those could
 * leave buttons inside only partly tappable.
 */
export function SlideIn({ direction, children }: { direction: number; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(reduceMotion ? 0 : direction * size.control);
  const fade = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    offset.value = withTiming(0, { duration: motion.slideMs });
    fade.value = withTiming(1, { duration: motion.slideMs });
  }, [offset, fade]);
  const style = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateX: offset.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
