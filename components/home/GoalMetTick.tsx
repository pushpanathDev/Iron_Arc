import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "../../theme/theme";
import { radius, size } from "../../theme/tokens";
import { GlossFill } from "../ui/GlossFill";

const BADGE = 26;
/** A glint crosses the badge, then it rests this long before the next one. */
const GLINT_MS = 700;
const GLINT_REST_MS = 3200;

/** The week goal's tick once it's met: a glossy badge that pops in and catches the light now and then. */
export function GoalMetTick() {
  const { colors, gloss } = useTheme();
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(reduceMotion ? 1 : 0.4);
  const glint = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pop.value = withSpring(1, { damping: 9, stiffness: 180 });
    glint.value = withRepeat(withSequence(withDelay(400, withTiming(1, { duration: GLINT_MS, easing: Easing.inOut(Easing.quad) })), withDelay(GLINT_REST_MS, withTiming(0, { duration: 0 }))), -1);
  }, [reduceMotion, pop, glint]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const glintStyle = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(glint.value, [0, 1], [-BADGE, BADGE]) }, { rotate: "20deg" }] }));

  return (
    <Animated.View
      style={[{ width: BADGE, height: BADGE, borderRadius: radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: colors.accent }, popStyle]}
    >
      {gloss && <GlossFill gloss={gloss} />}
      {!reduceMotion && (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -BADGE / 2, width: BADGE / 2, height: BADGE * 2 }, glintStyle]}>
          <LinearGradient colors={["transparent", "rgba(255, 255, 255, 0.6)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
      )}
      <View pointerEvents="none">
        <MaterialIcons name="check" size={size.iconSm} color={colors.onAccent} />
      </View>
    </Animated.View>
  );
}
