import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";

const PULSE_MS = 1100;
const SWEEP_MS = 1400;
/** Each input gets its tick this long after the previous one. */
const TICK_MS = 700;
/** The moving highlight's share of the track. */
const BAR_SHARE = 0.35;

export type GeneratingOverlayProps = {
  visible: boolean;
  title: string;
  /** What the AI is working from, in plain words (all true inputs, no fake steps). */
  inputs: string[];
  onStopWaiting: () => void;
};

/**
 * While the AI builds or recalibrates a plan (usually about 10 s; up to a minute when the AI is busy). No
 * percentage: the server answers in one go, so the bar only shows activity.
 * "Stop waiting" closes this; the request still finishes and the plan appears.
 */
export function GeneratingOverlay({ visible, title, inputs, onStopWaiting }: GeneratingOverlayProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (!visible || reduceMotion) return;
    // Start from the beginning each time (a second run from where the last one stopped didn't move).
    pulse.value = 1;
    sweep.value = 0;
    pulse.value = withRepeat(withTiming(0.55, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }), -1, true);
    sweep.value = withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.cubic) }), -1, false);
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(sweep);
    };
  }, [visible, reduceMotion, pulse, sweep]);

  // Tick the inputs off one by one (presentation only: no claim about server progress).
  const [ticked, setTicked] = useState(0);
  useEffect(() => {
    if (!visible) {
      setTicked(0);
      return;
    }
    if (reduceMotion) {
      setTicked(inputs.length);
      return;
    }
    const t = setInterval(() => setTicked((n) => (n >= inputs.length ? n : n + 1)), TICK_MS);
    return () => clearInterval(t);
  }, [visible, reduceMotion, inputs.length]);

  const emblem = useAnimatedStyle(() => ({ opacity: pulse.value }));
  // The highlight slides across the track in pixels (animating a "left: x%" string didn't move on Android).
  const trackWidth = useSharedValue(0);
  const bar = useAnimatedStyle(() => ({
    transform: [{ translateX: (sweep.value * (1 + BAR_SHARE) - BAR_SHARE) * trackWidth.value }],
  }));

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onStopWaiting}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.screen }}>
        <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ width: size.statusDot, height: size.statusDot, borderRadius: radius.full, backgroundColor: colors.accent }} />
            <Text style={[typography.labelLg, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>AI coach</Text>
          </View>
          <Pressable onPress={onStopWaiting} accessibilityRole="button" hitSlop={spacing.sm} style={({ pressed }) => ({ minHeight: size.control, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
            <Text style={[typography.labelLg, { color: colors.textSecondary }]}>Stop waiting</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, justifyContent: "center", gap: spacing.xl }}>
          <View style={{ alignItems: "center", gap: spacing.lg }}>
            <Animated.View style={[{ width: size.ring, height: size.ring, borderRadius: radius.full, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.accentTint }, emblem]}>
              <MaterialIcons name="flash-on" size={size.iconLg * 2} color={colors.accent} />
            </Animated.View>
            <View style={{ alignItems: "center", gap: spacing.xs }} accessibilityLiveRegion="polite">
              <Text style={[typography.headlineLg, { color: colors.text, textAlign: "center" }]} accessibilityRole="header">
                {title}
              </Text>
              <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>Usually about 10 seconds.</Text>
            </View>
          </View>

          <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised }}>
            <View
              onLayout={(e) => (trackWidth.value = e.nativeEvent.layout.width)}
              style={{ height: size.progressBar, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh, overflow: "hidden" }}
              accessibilityLabel="Working"
            >
              <Animated.View
                style={[
                  { position: "absolute", top: 0, bottom: 0, left: 0, width: `${BAR_SHARE * 100}%`, borderRadius: radius.full, backgroundColor: colors.accent },
                  reduceMotion ? { width: "100%", opacity: 0.4 } : bar,
                ]}
              />
            </View>
            <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>What I&apos;m using</Text>
            {inputs.map((line, i) => (
              <InputRow key={line} text={line} done={i < ticked} />
            ))}
          </View>
        </View>

        <Text style={[typography.labelSm, { color: colors.textMuted, textAlign: "center" }]}>You can swap any exercise once it&apos;s ready. If you stop waiting, the plan still appears when it&apos;s done.</Text>
      </View>
    </Modal>
  );
}

/** One input: an empty circle that turns into a tick (scale + fade), text brightening with it. */
function InputRow({ text, done }: { text: string; done: boolean }) {
  const { colors } = useTheme();
  const p = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(done ? 1 : 0, { duration: TICK_MS / 2, easing: Easing.out(Easing.back(2)) });
  }, [done, p]);
  const tick = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.4 + p.value * 0.6 }] }));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }} accessible accessibilityLabel={`${text}${done ? ", done" : ""}`}>
      <View style={{ width: size.iconSm, height: size.iconSm, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", width: size.iconSm - spacing.xs, height: size.iconSm - spacing.xs, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.textMuted }} />
        <Animated.View style={[{ position: "absolute", width: size.iconSm, height: size.iconSm, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent }, tick]}>
          <MaterialIcons name="check" size={size.iconXs} color={colors.onAccent} />
        </Animated.View>
      </View>
      <Text style={[typography.bodyMd, { flex: 1, color: done ? colors.text : colors.textMuted }]}>{text}</Text>
    </View>
  );
}
