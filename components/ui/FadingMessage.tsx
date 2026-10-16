import { useEffect, useState } from "react";
import { type StyleProp, type TextStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { motion, typography } from "../../theme/tokens";

export type FadingMessageProps = {
  message?: string | null;
  color: string;
  /** Lines of space kept even when empty, so the layout never jumps. */
  reserveLines?: number;
  live?: boolean;
  style?: StyleProp<TextStyle>;
};

/**
 * A fixed-height message slot. Only opacity animates: no layout animation,
 * so nothing around it can get stuck mid-transition.
 */
export function FadingMessage({ message, color, reserveLines = 1, live = false, style }: FadingMessageProps) {
  // Keep the last text while fading out so it doesn't vanish abruptly.
  const [shown, setShown] = useState(message ?? "");
  const opacity = useSharedValue(message ? 1 : 0);

  useEffect(() => {
    if (message) {
      setShown(message);
      opacity.value = withTiming(1, { duration: motion.focusMs });
    } else {
      opacity.value = withTiming(0, { duration: motion.focusMs });
    }
  }, [message, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.Text
      accessibilityLiveRegion={live && message ? "polite" : "none"}
      accessibilityElementsHidden={!message}
      importantForAccessibility={message ? "auto" : "no-hide-descendants"}
      style={[
        typography.labelSm,
        { color, minHeight: typography.labelSm.lineHeight * reserveLines },
        style,
        fade,
      ]}
    >
      {shown}
    </Animated.Text>
  );
}
