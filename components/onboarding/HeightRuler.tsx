import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { useTheme } from "../../theme/theme";
import { materials, radius, ruler, spacing, typography, withAlpha } from "../../theme/tokens";
import { CM_MAX, CM_MIN, formatFtIn, heightInUnit, heightToCm, IN_MAX, IN_MIN, type HeightUnit } from "../../utils/height";
import { perfEndAfterFrame, perfMark, perfStart } from "../../utils/perf";
import { SkeletonBlock } from "../ui/Skeleton";

/** Dragging past either end moves the drum this fraction of the finger. */
const RUBBER = 0.3;
const SNAP = { damping: 26, stiffness: 260, mass: 0.6 };
/** Marks fade out once they are this far round the drum (1 = the top or bottom edge). */
const EDGE = 1.05;
/** Half the drum's inner height, from the tokens: housing border, padding and bezel. */
const DRUM_HALF = (ruler.height - 2 - 2 * ruler.padding - 2 * ruler.bezel) / 2;

type Props = {
  cm: number;
  unit: HeightUnit;
  /** Called once the drum settles on a value (and on accessibility steps), not while it moves. */
  onChangeCm: (cm: number) => void;
};

/**
 * One unit's drum. Marks are a fixed set of recycled slots: slot k always shows
 * the mark nearest the needle whose index is k (mod `slots`), so only the ~30
 * (cm) or ~48 (ft-in) marks that can be on screen exist. `slots` is a multiple of
 * the marking pattern, so a slot's look (length, numbered or not) never changes;
 * only its number does, picked on the UI thread from a short column.
 */
type Scale = {
  min: number;
  max: number;
  /** Value between two marks: 1 cm, or a quarter inch. */
  perMark: number;
  pxPerMark: number;
  slots: number;
  /** How the mark at this index (value / perMark) looks. */
  markLook: (index: number) => { length: number; stroke: number; labelSize: number; label: ((index: number) => string) | null };
};

function slotCount(pattern: number, pxPerMark: number) {
  const reach = Math.ceil((EDGE * DRUM_HALF) / pxPerMark) + 1;
  return Math.ceil((2 * reach + 1) / pattern) * pattern;
}

const PX_PER_QUARTER_INCH = (ruler.pxPerCm * 2.54) / 4;

const SCALES: Record<HeightUnit, Scale> = {
  cm: {
    min: CM_MIN,
    max: CM_MAX,
    perMark: 1,
    pxPerMark: ruler.pxPerCm,
    slots: slotCount(10, ruler.pxPerCm),
    markLook: (i) => {
      const major = i % 10 === 0;
      const half = i % 5 === 0;
      return { length: major ? ruler.tickCm.major : half ? ruler.tickCm.half : ruler.tickCm.minor, stroke: major ? 2 : 1, labelSize: ruler.numeral, label: major ? (n) => `${n}` : null };
    },
  },
  ft: {
    min: IN_MIN,
    max: IN_MAX,
    perMark: 0.25,
    pxPerMark: PX_PER_QUARTER_INCH,
    slots: slotCount(48, PX_PER_QUARTER_INCH),
    markLook: (q) => {
      const whole = q % 4 === 0;
      const foot = q % 48 === 0;
      const halfFoot = q % 24 === 0;
      const length = foot ? ruler.tickIn.foot : halfFoot ? ruler.tickIn.halfFoot : whole ? ruler.tickIn.inch : ruler.tickIn.quarter;
      const label = foot ? (n: number) => `${n / 48}′` : halfFoot ? (n: number) => `${Math.floor(n / 48)}′6″` : null;
      return { length, stroke: foot ? 2 : 1, labelSize: foot ? ruler.numeral + 1 : ruler.numeral - 2, label };
    },
  },
};

/** The mark index slot k shows: the one nearest the needle among k, k ± slots, … */
function slotIndex(k: number, at: number, slots: number) {
  "worklet";
  return k + slots * Math.round((at - k) / slots);
}

const PERF = "height ruler";
/** Started by a screen when the user asks for the ruler (Profile → Height). */
export const PERF_OPEN = "open height ruler";

/**
 * Height picker drawn as a measuring drum in a metal housing (Ruler_Component
 * mockup): ink marks on an ivory cylinder that bends away at the top and
 * bottom, a fixed red needle, and the reading beside it. Drag the drum (down
 * for taller); it carries on with momentum, then settles on a whole cm or inch
 * with a light detent tick. Centimetres are what's stored.
 *
 * A placeholder shows for the first two frames so the screen or sheet around
 * it appears without waiting on the drum.
 */
export function HeightRuler(props: Props) {
  useState(() => perfStart(PERF));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    perfMark(PERF_OPEN, "placeholder shown");
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  if (!ready) {
    return (
      <View accessibilityLabel="Loading height ruler">
        <SkeletonBlock height={ruler.height} radius="xl" />
      </View>
    );
  }
  // A fresh drum per unit, starting on the right value from its first frame.
  return <Drum key={props.unit} {...props} />;
}

function Drum({ cm, unit, onChangeCm }: Props) {
  const { colors } = useTheme();
  const scale = SCALES[unit];
  const { min, max, perMark, pxPerMark } = scale;
  const pxPerStep = pxPerMark / perMark;
  const selected = heightInUnit(cm, unit);

  // Drum position in the current unit (fractional while moving); `moving` from touch until it settles.
  const position = useSharedValue(selected);
  const moving = useSharedValue(false);
  const drumHeight = useSharedValue(0);
  const dragStart = useSharedValue(0);

  // A value set from outside (sheet reopened with another height): jump there.
  useEffect(() => {
    if (moving.value || Math.round(position.value) === selected) return;
    cancelAnimation(position);
    position.value = selected;
  }, [selected, position, moving]);

  // Stable for the gesture (built once), always calling the latest onChangeCm.
  const settleRef = useRef((v: number) => onChangeCm(heightToCm(v, unit)));
  settleRef.current = (v: number) => onChangeCm(heightToCm(v, unit));
  const settle = useCallback((v: number) => settleRef.current(v), []);

  const snapTo = useCallback(
    (target: number) => {
      "worklet";
      position.value = withSpring(target, SNAP, (done) => {
        if (!done) return;
        moving.value = false;
        runOnJS(settle)(target);
      });
    },
    [position, moving, settle],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-4, 4])
        .onBegin(() => {
          cancelAnimation(position);
          moving.value = true;
          dragStart.value = position.value;
        })
        .onUpdate((e) => {
          // Down brings larger values in from above, like turning a wall chart.
          let v = dragStart.value + e.translationY / pxPerStep;
          if (v > max) v = max + (v - max) * RUBBER;
          else if (v < min) v = min - (min - v) * RUBBER;
          position.value = v;
        })
        .onEnd((e) => {
          position.value = withDecay({ velocity: e.velocityY / pxPerStep, deceleration: 0.994, clamp: [min, max], rubberBandEffect: true, rubberBandFactor: 0.6 }, (finished) => {
            if (finished) snapTo(Math.round(Math.min(max, Math.max(min, position.value))));
          });
        })
        .onFinalize((_e, success) => {
          // A tap that stopped a spinning drum: settle on the nearest mark.
          if (!success) snapTo(Math.round(Math.min(max, Math.max(min, position.value))));
        }),
    [position, moving, dragStart, pxPerStep, min, max, snapTo],
  );

  const nudge = (delta: number) => snapTo(Math.min(max, Math.max(min, Math.round(position.value) + delta)));

  const laidOut = useRef(false);
  const onDrumLayout = (e: LayoutChangeEvent) => {
    drumHeight.value = e.nativeEvent.layout.height;
    if (laidOut.current) return;
    laidOut.current = true;
    perfEndAfterFrame(PERF);
    perfEndAfterFrame(PERF_OPEN);
  };

  const slots = useMemo(() => Array.from({ length: scale.slots }, (_, k) => k), [scale]);
  const minIndex = Math.round(min / perMark);
  const maxIndex = Math.round(max / perMark);

  return (
    <LinearGradient
      colors={[materials.housingTop, materials.housingMid, materials.housingBottom]}
      style={{ height: ruler.height, borderRadius: radius.xl, borderWidth: 1, borderColor: withAlpha(colors.border, 0.4), padding: ruler.padding, flexDirection: "row", alignItems: "stretch", gap: ruler.padding }}
    >
      {/* Drum in its bezel */}
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Height"
          accessibilityValue={{ text: unit === "cm" ? `${selected} centimetres` : `${Math.floor(selected / 12)} feet ${selected % 12} inches` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? 1 : -1)}
          style={{ flex: ruler.drumShare }}
        >
          <LinearGradient
            colors={[materials.bezelLight, materials.bezelMid, materials.bezelDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: ruler.bezelRadius, padding: ruler.bezel }}
          >
            <View onLayout={onDrumLayout} style={{ flex: 1, borderRadius: ruler.cavityRadius, overflow: "hidden", backgroundColor: materials.cavity }}>
              {/* Ivory cylinder face, brightest across the middle */}
              <LinearGradient
                colors={[materials.drumTungsten, materials.drumSilver, materials.drumIvory, materials.drumIvory, materials.drumSilver, materials.drumTungsten]}
                locations={[0, 0.18, 0.42, 0.58, 0.82, 1]}
                style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
              />
              {slots.map((k) => (
                <Mark key={k} k={k} scale={scale} minIndex={minIndex} maxIndex={maxIndex} position={position} drumHeight={drumHeight} />
              ))}
              {/* Shade toward the poles, and a faint glass glare */}
              <LinearGradient
                pointerEvents="none"
                colors={[withAlpha(materials.cavity, 0.92), withAlpha(materials.drumTungsten, 0.4), withAlpha(materials.drumIvory, 0), withAlpha(materials.drumIvory, 0), withAlpha(materials.drumTungsten, 0.4), withAlpha(materials.cavity, 0.92)]}
                locations={[0, 0.18, 0.42, 0.58, 0.82, 1]}
                style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
              />
              <LinearGradient
                pointerEvents="none"
                colors={[materials.glare, materials.glareSoft, "transparent"]}
                locations={[0, 0.3, 0.6]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.7 }}
                style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
              />
              <Needle />
            </View>
          </LinearGradient>
        </View>
      </GestureDetector>

      <Reading position={position} moving={moving} unit={unit} min={min} max={max} initial={selected} />
    </LinearGradient>
  );
}

/**
 * The big number beside the drum. Its own component so a detent re-renders
 * only this text, never the drum.
 */
function Reading({ position, moving, unit, min, max, initial }: { position: SharedValue<number>; moving: SharedValue<boolean>; unit: HeightUnit; min: number; max: number; initial: number }) {
  const { colors } = useTheme();
  const [shown, setShown] = useState(initial);
  const detent = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  useAnimatedReaction(
    () => Math.round(Math.min(max, Math.max(min, position.value))),
    (now, prev) => {
      if (prev === null || now === prev) return;
      runOnJS(setShown)(now);
      if (moving.value) runOnJS(detent)();
    },
    [min, max],
  );

  return (
    <View style={{ flex: 1 - ruler.drumShare, justifyContent: "center" }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={{ position: "absolute", left: -ruler.padding, top: "50%", width: ruler.leader, height: 1, backgroundColor: withAlpha(materials.needle, 0.4) }} />
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xs }}>
        <Text style={[typography.displayXl, { color: colors.text, fontVariant: ["tabular-nums"] }]} numberOfLines={1} adjustsFontSizeToFit>
          {unit === "cm" ? `${shown}` : formatFtIn(shown)}
        </Text>
        {unit === "cm" && <Text style={[typography.headlineMd, { color: colors.textSecondary, textTransform: "uppercase" }]}>cm</Text>}
      </View>
    </View>
  );
}

type MarkProps = { k: number; scale: Scale; minIndex: number; maxIndex: number; position: SharedValue<number>; drumHeight: SharedValue<number> };

/** One recycled slot, placed on the curved drum: squeezed and faded toward the top and bottom. */
const Mark = memo(function Mark({ k, scale, minIndex, maxIndex, position, drumHeight }: MarkProps) {
  const { perMark, pxPerMark, slots } = scale;
  const look = scale.markLook(k);
  const rowHeight = look.labelSize + spacing.xs;

  const style = useAnimatedStyle(() => {
    const h = drumHeight.value;
    const half = h / 2;
    const at = position.value / perMark;
    const index = slotIndex(k, at, slots);
    const norm = h > 0 ? (-(index - at) * pxPerMark) / half : 2;
    if (index < minIndex || index > maxIndex || Math.abs(norm) > EDGE) return { opacity: 0, transform: [{ translateY: -h }, { scaleY: 1 }] };
    const angle = Math.asin(Math.max(-0.96, Math.min(0.96, norm)));
    const cos = Math.cos(angle);
    return {
      opacity: Math.max(0.2, Math.pow(cos, 1.2)),
      transform: [{ translateY: half + Math.sin(angle) * half * 0.94 }, { scaleY: Math.max(0.48, cos) }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: -rowHeight / 2, height: rowHeight, flexDirection: "row", alignItems: "center", gap: ruler.labelGap }, style]}>
      <View style={{ width: look.length, height: look.stroke, backgroundColor: materials.ink }} />
      {look.label ? <Numbers k={k} slots={slots} perMark={perMark} minIndex={minIndex} maxIndex={maxIndex} rowHeight={rowHeight} labelSize={look.labelSize} label={look.label} position={position} /> : null}
    </Animated.View>
  );
});

type NumbersProps = {
  k: number;
  slots: number;
  perMark: number;
  minIndex: number;
  maxIndex: number;
  rowHeight: number;
  labelSize: number;
  label: (index: number) => string;
  position: SharedValue<number>;
};

/** Every number a slot can show, stacked; the column slides to the one in use. */
function Numbers({ k, slots, perMark, minIndex, maxIndex, rowHeight, labelSize, label, position }: NumbersProps) {
  // The slot's lowest mark in range, then every `slots` marks up to the top.
  const first = minIndex + ((((k - minIndex) % slots) + slots) % slots);
  const options = useMemo(() => {
    const out: number[] = [];
    for (let i = first; i <= maxIndex; i += slots) out.push(i);
    return out;
  }, [first, maxIndex, slots]);
  const last = options.length - 1;

  const column = useAnimatedStyle(() => {
    const index = slotIndex(k, position.value / perMark, slots);
    const row = Math.min(last, Math.max(0, Math.round((index - first) / slots)));
    return { transform: [{ translateY: -row * rowHeight }] };
  });

  const text = { fontFamily: typography.headlineSm.fontFamily, fontSize: labelSize, lineHeight: rowHeight, height: rowHeight, color: materials.ink, includeFontPadding: false } as const;
  return (
    <View style={{ height: rowHeight, overflow: "hidden" }}>
      <Animated.View style={column}>
        {options.map((i) => (
          <Text key={i} style={text}>
            {label(i)}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/** Fixed red needle across the drum, with inward tips at both ends. */
function Needle() {
  const tip = { width: 0, height: 0, borderTopWidth: ruler.needleTipHalf, borderBottomWidth: ruler.needleTipHalf, borderTopColor: "transparent", borderBottomColor: "transparent" } as const;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "50%", marginTop: -ruler.needleTipHalf, height: ruler.needleTipHalf * 2, flexDirection: "row", alignItems: "center" }}>
      <View style={[tip, { borderLeftWidth: ruler.needleTip, borderLeftColor: materials.needle }]} />
      <View style={{ flex: 1, height: ruler.needle, backgroundColor: materials.needle }} />
      <View style={[tip, { borderRightWidth: ruler.needleTip, borderRightColor: materials.needle }]} />
    </View>
  );
}
