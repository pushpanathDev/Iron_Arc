import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useTheme } from "../../theme/theme";
import { alpha, radius, ruler, size, spacing, typography, withAlpha } from "../../theme/tokens";

export const HEIGHT_MIN_CM = 100;
export const HEIGHT_MAX_CM = 250;
const CM_PER_INCH = 2.54;
const IN_MIN = Math.ceil(HEIGHT_MIN_CM / CM_PER_INCH);
const IN_MAX = Math.floor(HEIGHT_MAX_CM / CM_PER_INCH);
/** Rows further than this from the centre all look the same, so they never redraw. */
const FADE_STEPS = 3;

export type HeightUnit = "cm" | "ft";

export const cmToInches = (cm: number) => Math.round(cm / CM_PER_INCH);
export const inchesToCm = (inches: number) => Math.round(inches * CM_PER_INCH);
export const formatFtIn = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}"`;

const PAD = (ruler.height - ruler.item) / 2;

function opacityFor(distance: number) {
  if (distance === 0) return 1;
  if (distance === 1) return alpha.muted;
  if (distance === 2) return alpha.faint;
  return alpha.ghost;
}

type Props = {
  cm: number;
  unit: HeightUnit;
  /** Called when the scroll settles (and on accessibility steps), not on every tick. */
  onChangeCm: (cm: number) => void;
};

/**
 * Height picker: a live readout above a vertical ruler (larger values above,
 * smaller below, snapping one value per tick). In ft-in it steps by whole
 * inches; switching units never moves the stored centimetres.
 *
 * Smoothness: while scrolling only this component updates (readout + the few
 * rows near the centre, which are memoised by their distance); the parent form
 * hears about the value once the scroll settles, so it never re-renders mid-scroll.
 */
export function HeightRuler({ cm, unit, onChangeCm }: Props) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [max, min] = unit === "cm" ? [HEIGHT_MAX_CM, HEIGHT_MIN_CM] : [IN_MAX, IN_MIN];
  const values = useMemo(() => Array.from({ length: max - min + 1 }, (_, i) => max - i), [max, min]);
  const selected = unit === "cm" ? cm : cmToInches(cm);
  const [current, setCurrent] = useState(selected);
  const currentRef = useRef(selected);
  const reportedRef = useRef(selected);

  // Jump when the value changes from outside (unit switch); our own scrolling
  // already updated currentRef, so it doesn't loop.
  useEffect(() => {
    if (currentRef.current === selected) return;
    currentRef.current = selected;
    reportedRef.current = selected;
    setCurrent(selected);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: (max - selected) * ruler.item, animated: false }));
  }, [selected, max]);

  /** Live: readout and nearby rows only. */
  const preview = (value: number) => {
    if (value === currentRef.current) return;
    currentRef.current = value;
    setCurrent(value);
    Haptics.selectionAsync().catch(() => {});
  };

  /** Settled: tell the form once. */
  const report = () => {
    const value = currentRef.current;
    if (value === reportedRef.current) return;
    reportedRef.current = value;
    onChangeCm(unit === "cm" ? value : inchesToCm(value));
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ruler.item);
    preview(Math.min(max, Math.max(min, max - i)));
  };

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, currentRef.current + delta));
    scrollRef.current?.scrollTo({ y: (max - next) * ruler.item, animated: true });
    preview(next);
    report();
  };

  const label = (v: number) => (unit === "cm" ? `${v}` : formatFtIn(v));

  return (
    <View style={{ alignItems: "center", gap: spacing.md }}>
      {/* Live readout */}
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceContainerHigh,
          flexDirection: "row",
          alignItems: "baseline",
          gap: spacing.xs,
        }}
      >
        <Text style={[typography.displayMd, { color: colors.accent, fontVariant: ["tabular-nums"] }]}>{label(current)}</Text>
        {unit === "cm" && <Text style={[typography.labelMd, { color: colors.accent }]}>cm</Text>}
      </View>

      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Height"
        accessibilityValue={{ text: unit === "cm" ? `${current} centimetres` : formatFtIn(current) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
        style={{ alignSelf: "stretch", height: ruler.height, overflow: "hidden" }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: spacing.lg,
            right: spacing.lg,
            top: (ruler.height - ruler.band) / 2,
            height: ruler.band,
            borderRadius: radius.sm,
            backgroundColor: withAlpha(colors.accent, alpha.band),
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.sm,
          }}
        >
          <MaterialIcons name="arrow-right" size={size.iconSm} color={colors.accent} />
          <MaterialIcons name="arrow-left" size={size.iconSm} color={colors.accent} />
        </View>

        <ScrollView
          ref={scrollRef}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={ruler.item}
          decelerationRate="normal"
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={report}
          onScrollEndDrag={report}
          contentOffset={{ x: 0, y: (max - selected) * ruler.item }}
          contentContainerStyle={{ paddingVertical: PAD }}
        >
          {values.map((v) => (
            <RulerRow key={v} label={label(v)} distance={Math.min(Math.abs(v - current), FADE_STEPS)} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/** One tick. Memoised on its (capped) distance, so a scroll step redraws only the rows around the centre. */
const RulerRow = memo(function RulerRow({ label, distance }: { label: string; distance: number }) {
  const { colors } = useTheme();
  const active = distance === 0;
  return (
    <View
      renderToHardwareTextureAndroid
      style={{
        height: ruler.item,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.lg,
        opacity: opacityFor(distance),
      }}
    >
      <Text
        style={[
          active ? typography.headlineMd : typography.headlineSm,
          { width: ruler.labelWidth, textAlign: "right", color: active ? colors.accent : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: active ? spacing.inline : spacing.xs }}>
        <View
          style={{
            width: active ? ruler.tickActive : ruler.tick,
            height: active ? ruler.strokeActive : ruler.stroke,
            borderRadius: radius.full,
            backgroundColor: active ? colors.accent : colors.borderStrong,
          }}
        />
        {[0, 1].map((k) => (
          <View
            key={k}
            style={{
              width: active ? ruler.tickActiveMinor : ruler.tickMinor,
              height: ruler.stroke,
              backgroundColor: active ? withAlpha(colors.accent, alpha.muted) : colors.border,
            }}
          />
        ))}
      </View>
    </View>
  );
});

export default HeightRuler;
