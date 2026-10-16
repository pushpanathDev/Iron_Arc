import { useState, type ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { motion } from "../../theme/tokens";

type PressState = { pressed: boolean };

export type PressableScaleProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle> | ((state: PressState) => StyleProp<ViewStyle>);
  children?: ReactNode | ((state: PressState) => ReactNode);
  /** Scale while pressed; defaults to motion.pressScale (0.99). */
  pressedScale?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable that scales down slightly while pressed. Accepts the same style
 * and children (plain or `({ pressed }) => ...`) as Pressable.
 *
 * The Pressable itself draws the control (fill, radius, padding, size) and is
 * the one that scales, so the touch target is exactly the visible box: a tap
 * anywhere inside the button counts, not just on its label. (An earlier
 * version drew the box on an inner view, and on Android only the label area
 * reliably took taps.) Pressed state is tracked here because Reanimated's
 * animated components don't accept a style function.
 */
export function PressableScale({
  style,
  children,
  onPressIn,
  onPressOut,
  pressedScale = motion.pressScale,
  ...rest
}: PressableScaleProps) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const scaled = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const state = { pressed };

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        scale.value = withTiming(pressedScale, { duration: motion.pressMs });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        scale.value = withTiming(1, { duration: motion.pressMs });
        onPressOut?.(e);
      }}
      style={[typeof style === "function" ? style(state) : style, scaled]}
    >
      {typeof children === "function" ? children(state) : children}
    </AnimatedPressable>
  );
}
