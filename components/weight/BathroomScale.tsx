import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../theme/theme";
import { alpha, elevation, fontFamily, motion, radius, size, spacing, tracking, typography, withAlpha } from "../../theme/tokens";
import { formatValue, maxFor, WEIGHT_STEP } from "../../utils/bodyWeightRules";
import { weightLabel, type WeightUnit } from "../../utils/unitConversion";
import { PulsingDot } from "../ui/StatusIndicators";

/*
 * A mechanical bathroom scale seen from above. The reading is a printed tape
 * rolling behind a glass window under a fixed red pointer, the way real
 * analog scales work. Stepping on (tap, or changing the weight) dips the
 * platform, shows footprints and rolls the tape from 0 to the weight on a
 * spring that overshoots a little and settles. Stepping off rolls it back.
 *
 * The tape covers 0 → the maximum loggable weight, drawn once in fixed-width
 * chunks (one SVG each, so no single view gets wider than phones can draw);
 * only one transform moves per frame.
 */

type TapeSpec = { ppu: number; minor: number; mid: number; major: number; chunk: number };

/** px per unit, ticks every minor / mid (numbered) / major, and SVG chunk length in units. */
const TAPE: Record<WeightUnit, TapeSpec> = {
  kg: { ppu: 14, minor: 1, mid: 5, major: 10, chunk: 50 },
  lbs: { ppu: 7, minor: 2, mid: 10, major: 50, chunk: 100 },
};

const TICK_MINOR = 10;
const TICK_MID = 17;
const TICK_MAJOR = 22;
const RIBS = 14;
const PRESS_SCALE = 0.985;

export type BathroomScaleProps = {
  /** Display unit; null = nobody on the scale. */
  value: number | null;
  unit: WeightUnit;
};

export function BathroomScale({ value, unit }: BathroomScaleProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [on, setOn] = useState(false);
  const [windowW, setWindowW] = useState(0);
  const spec = TAPE[unit];
  const tapeMax = Math.ceil(maxFor(unit) / spec.chunk) * spec.chunk;

  // First visit with a weight: step on by itself after a beat, so the reading rolls in.
  const autoStepped = useRef(false);
  useEffect(() => {
    if (autoStepped.current || value == null) return;
    autoStepped.current = true;
    const t = setTimeout(() => setOn(true), motion.dialStepOnMs);
    return () => clearTimeout(t);
  }, [value]);

  // Changing the weight means someone is on the scale.
  const lastValue = useRef(value);
  useEffect(() => {
    if (lastValue.current !== value && value != null && autoStepped.current) setOn(true);
    lastValue.current = value;
  }, [value]);

  // Animation
  const reading = on && value != null ? Math.min(Math.max(value, 0), tapeMax) : 0;
  const pos = useSharedValue(0); // units under the pointer
  const press = useSharedValue(0); // 0 = empty platform, 1 = someone on it
  useEffect(() => {
    pos.value = reduceMotion
      ? withTiming(reading, { duration: 0 })
      : withSpring(reading, { ...motion.scaleSpring, overshootClamping: value != null && value >= tapeMax });
  }, [reading, reduceMotion, pos, value, tapeMax]);
  useEffect(() => {
    press.value = reduceMotion ? (on ? 1 : 0) : withSpring(on ? 1 : 0, motion.pressSpring);
  }, [on, reduceMotion, press]);

  const tapeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: windowW / 2 - Math.max(0, pos.value) * spec.ppu }] }));
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(press.value, [0, 1], [1, PRESS_SCALE]) }] }));

  const toggle = () => {
    Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setOn((v) => !v);
  };

  const shown = on && value != null;
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={shown ? `Scale reads ${formatValue(value!)} ${weightLabel(unit)}` : "Scale, nobody on it"}
      accessibilityHint={on ? "Step off the scale" : "Step on the scale"}
      style={{ alignSelf: "center", width: "86%" }}
    >
      <Animated.View style={[{ aspectRatio: 1 / size.scaleAspect, borderRadius: size.scaleCorner, ...elevation.md }, bodyStyle]}>
        <LinearGradient
          colors={[colors.surfaceContainerHighest, colors.surfaceContainerHigh, colors.raised]}
          style={{ flex: 1, borderRadius: size.scaleCorner, borderWidth: size.divider, borderColor: colors.border, padding: spacing.md, gap: spacing.md }}
        >
          {/* Reading window */}
          <View
            style={{ height: size.scaleWindow, borderRadius: radius.lg, padding: spacing.xs, backgroundColor: colors.surfaceContainerLowest, borderWidth: size.divider * 2, borderColor: colors.borderStrong }}
          >
            <View onLayout={(e: LayoutChangeEvent) => setWindowW(Math.round(e.nativeEvent.layout.width))} style={{ flex: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.text }}>
              {windowW > 0 && (
                <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, flexDirection: "row" }, tapeStyle]}>
                  <Tape spec={spec} max={tapeMax} height={size.scaleWindow - spacing.xs * 2 - size.divider * 4} />
                </Animated.View>
              )}
              {/* Drum shading: dark edges and a lower shadow make the flat tape read as a cylinder. */}
              <LinearGradient
                pointerEvents="none"
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                colors={[withAlpha(colors.surfaceContainerLowest, 0.85), withAlpha(colors.surfaceContainerLowest, 0), withAlpha(colors.surfaceContainerLowest, 0), withAlpha(colors.surfaceContainerLowest, 0.85)]}
                locations={[0, 0.3, 0.7, 1]}
                style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
              />
              <LinearGradient
                pointerEvents="none"
                colors={[withAlpha(colors.text, alpha.half), withAlpha(colors.text, 0), withAlpha(colors.surfaceContainerLowest, alpha.ghost)]}
                locations={[0, 0.35, 1]}
                style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
              />
              {/* Fixed pointer */}
              <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: windowW / 2 - size.divider, width: size.divider * 2, backgroundColor: colors.dangerSubtle }} />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: windowW / 2 - spacing.xs,
                  borderLeftWidth: spacing.xs,
                  borderRightWidth: spacing.xs,
                  borderTopWidth: spacing.sm,
                  borderLeftColor: "transparent",
                  borderRightColor: "transparent",
                  borderTopColor: colors.dangerSubtle,
                }}
              />
            </View>
          </View>

          {/* Capacity plate, as printed under the window of a real scale. */}
          <Text pointerEvents="none" style={[typography.labelSm, { color: colors.textMuted, textAlign: "center", letterSpacing: tracking.labelWide, marginTop: -spacing.xs }]}>
            {`MAX ${maxFor(unit)} ${weightLabel(unit)} · d = ${WEIGHT_STEP} ${weightLabel(unit)}`}
          </Text>

          {/* Platform: two ribbed foot pads (big toes toward the middle) */}
          <View style={{ flex: 1, flexDirection: "row", gap: spacing.md }}>
            <FootPad side="left" press={press} />
            <FootPad side="right" press={press} />
          </View>

          {/* Status pill */}
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: spacing.lg, alignItems: "center" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
                backgroundColor: withAlpha(colors.surfaceContainerLowest, alpha.divider),
                borderWidth: size.divider,
                borderColor: colors.border,
              }}
            >
              <PulsingDot color={on ? colors.warning : colors.accent} />
              <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>
                {on ? "Tap to step off" : "Tap to step on"}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const FootPad = memo(function FootPad({ side, press }: { side: "left" | "right"; press: SharedValue<number> }) {
  const { colors } = useTheme();
  // Footprints fade in as the platform takes the weight.
  const feetStyle = useAnimatedStyle(() => ({ opacity: interpolate(press.value, [0, 1], [0, alpha.faint]) }));
  return (
    <View style={{ flex: 1, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerLowest, borderWidth: size.divider, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, justifyContent: "space-between", overflow: "hidden" }}>
      {Array.from({ length: RIBS }, (_, i) => (
        <View key={i} style={{ height: size.divider * 2, borderRadius: radius.full, backgroundColor: colors.raised }} />
      ))}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" }, feetStyle]}>
        <MaterialCommunityIcons name="foot-print" size={size.iconBadge} color={colors.text} style={{ transform: side === "right" ? [{ scaleX: -1 }] : undefined }} />
      </Animated.View>
    </View>
  );
});

/** The printed tape: ticks hang from the top edge, numbers below; drawn once per unit. */
const Tape = memo(function Tape({ spec, max, height }: { spec: TapeSpec; max: number; height: number }) {
  const { colors } = useTheme();
  const chunks = useMemo(() => {
    const out: { start: number; d: string; labels: { x: number; v: number }[] }[] = [];
    for (let start = 0; start < max; start += spec.chunk) {
      let d = "";
      const labels: { x: number; v: number }[] = [];
      for (let v = start; v <= start + spec.chunk; v += spec.minor) {
        const x = (v - start) * spec.ppu;
        const len = v % spec.major === 0 ? TICK_MAJOR : v % spec.mid === 0 ? TICK_MID : TICK_MINOR;
        d += `M${x} 0V${len}`;
        if (v % spec.mid === 0 && v < start + spec.chunk) labels.push({ x, v });
      }
      out.push({ start, d, labels });
    }
    return out;
  }, [spec, max]);

  const w = spec.chunk * spec.ppu;
  return (
    <>
      {chunks.map((c) => (
        <Svg key={c.start} width={w} height={height}>
          <Path d={c.d} stroke={colors.surfaceContainerLowest} strokeWidth={1.5} />
          {c.labels.map((l) => (
            <SvgText
              key={l.v}
              x={l.x}
              y={height - spacing.sm}
              fontSize={l.v % spec.major === 0 ? size.tapeLabel : size.tapeLabel - 2}
              fontFamily={fontFamily.display}
              fill={colors.surfaceContainerLowest}
              textAnchor="middle"
            >
              {l.v}
            </SvgText>
          ))}
        </Svg>
      ))}
    </>
  );
});
