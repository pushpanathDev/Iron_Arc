import type { ReactNode } from "react";
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { motion } from "../../theme/tokens";

type PressState = { pressed: boolean };

export type PressableScaleProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle> | ((state: PressState) => StyleProp<ViewStyle>);
  children?: ReactNode | ((state: PressState) => ReactNode);
};

// Styles that position the control in its parent go on the outer Pressable;
// everything else (fill, radius, size, padding, content alignment) goes on the
// inner view that scales, so the background shrinks with the press.
const OUTER_KEYS = new Set<string>([
  "position", "top", "right", "bottom", "left", "start", "end",
  "inset", "insetBlock", "insetInline",
  "width", "minWidth", "maxWidth",
  "alignSelf", "flex", "flexGrow", "flexShrink", "flexBasis",
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "marginHorizontal", "marginVertical", "marginStart", "marginEnd",
  "zIndex", "display",
]);

function splitStyle(style: StyleProp<ViewStyle>): [ViewStyle, ViewStyle] {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const key of Object.keys(flat)) {
    (OUTER_KEYS.has(key) ? outer : inner)[key] = flat[key];
  }
  return [outer as ViewStyle, inner as ViewStyle];
}

/**
 * Pressable that scales down slightly while pressed. Accepts the same style
 * and children (plain or `({ pressed }) => ...`) as Pressable.
 */
export function PressableScale({ style, children, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const scaled = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const resolve = (state: PressState) => splitStyle(typeof style === "function" ? style(state) : style);

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withTiming(motion.pressScale, { duration: motion.pressMs });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: motion.pressMs });
        onPressOut?.(e);
      }}
      style={(state) => resolve(state)[0]}
    >
      {(state) => (
        <Animated.View style={[{ flexGrow: 1 }, resolve(state)[1], scaled]}>
          {typeof children === "function" ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}

export default PressableScale;
