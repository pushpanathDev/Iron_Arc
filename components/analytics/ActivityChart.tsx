import { MaterialIcons } from "@expo/vector-icons";
import { memo, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../../theme/theme";
import { motion, radius, size, spacing, typography } from "../../theme/tokens";
import type { ActivityBucket, PeriodComparison, PeriodStats } from "../../utils/analytics";
import { parseLocalDate } from "../../utils/dates";
import { Button } from "../ui/Button";

/** Space above the tallest bar for its value label. */
const VALUE_SPACE = typography.labelSm.lineHeight + spacing.xs;
const BAR_AREA = size.trendChart - VALUE_SPACE;

const UNIT_CHIP: Record<PeriodStats["bucketUnit"], string> = { day: "Sets per day", week: "Sets per week", month: "Sets per month" };

export type ActivityChartProps = {
  title: string;
  subtitle: string;
  buckets: ActivityBucket[];
  unit: PeriodStats["bucketUnit"];
  compare: PeriodComparison | null;
  /** Shown under the chart when there's no comparison (e.g. "Chart shows the last 12 months"). */
  note?: string | null;
  /** "View in History" for a selected day. */
  onOpenDay?: (day: string) => void;
  /** Week view: the user's planned training days, dotted under their labels. */
  plannedDays?: Set<string>;
};

/** "Tue 13 Oct", "12–18 Oct", "October 2026". */
function bucketTitle(b: ActivityBucket, unit: PeriodStats["bucketUnit"]) {
  const from = parseLocalDate(b.from);
  if (unit === "day") return from.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  if (unit === "month") return from.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const to = parseLocalDate(b.to);
  const month = to.toLocaleDateString(undefined, { month: "short" });
  return from.getMonth() === to.getMonth() ? `${from.getDate()}–${to.getDate()} ${month}` : `${from.getDate()} ${from.toLocaleDateString(undefined, { month: "short" })} – ${to.getDate()} ${month}`;
}

/**
 * Sets per day / week / month (the backend stores no durations). Tap a bar to
 * read it; today's is selected to start. Rest days are small pills, days
 * still to come are outlined.
 */
export function ActivityChart({ title, subtitle, buckets, unit, compare, note, onOpenDay, plannedDays }: ActivityChartProps) {
  const { colors } = useTheme();
  const max = Math.max(1, ...buckets.map((b) => b.sets));
  const gap = buckets.length > 10 ? spacing.xs : spacing.sm;

  const initial = buckets.find((b) => b.current)?.key ?? null;
  const [selectedKey, setSelectedKey] = useState<string | null>(initial);
  // New period → start again from the current bar.
  const bucketsId = buckets.map((b) => b.key).join();
  useEffect(() => setSelectedKey(initial), [bucketsId, initial]);
  const selected = buckets.find((b) => b.key === selectedKey) ?? null;

  return (
    <View style={{ backgroundColor: colors.raised, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm }}>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text style={[typography.headlineSm, { color: colors.text }]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh }}>
          <Text style={[typography.labelSm, { color: colors.accent }]}>{UNIT_CHIP[unit]}</Text>
        </View>
      </View>

      <View>
        <View style={{ height: size.trendChart, flexDirection: "row", alignItems: "flex-end", gap }}>
          {buckets.map((b) => (
            <Bar
              key={b.key}
              bucket={b}
              height={b.sets > 0 ? Math.max(spacing.sm, Math.round((b.sets / max) * BAR_AREA)) : 0}
              selected={b.key === selectedKey}
              title={bucketTitle(b, unit)}
              onPress={() => setSelectedKey((k) => (k === b.key ? null : b.key))}
            />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap, marginTop: spacing.sm }}>
          {buckets.map((b) => (
            <View key={b.key} style={{ flex: 1, alignItems: "center", gap: spacing.xxs }}>
              <Text
                numberOfLines={1}
                style={[typography.labelSm, { fontSize: size.chartLabel, textAlign: "center", color: b.key === selectedKey || b.current ? colors.accent : colors.textSecondary }]}
              >
                {b.label}
              </Text>
              {plannedDays && (
                <View style={{ width: size.dot, height: size.dot, borderRadius: radius.full, backgroundColor: plannedDays.has(b.key) ? colors.accent : "transparent" }} />
              )}
            </View>
          ))}
        </View>
        {plannedDays && plannedDays.size > 0 && (
          <Text style={[typography.labelSm, { fontSize: size.chartLabel, color: colors.textSecondary, marginTop: spacing.xs }]}>Dot = planned training day</Text>
        )}
      </View>

      {/* Selected bar */}
      <View
        accessibilityLiveRegion="polite"
        style={{ minHeight: size.control, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}
      >
        {selected ? (
          <>
            <View style={{ flex: 1, paddingVertical: spacing.sm }}>
              <Text style={[typography.labelLg, { color: colors.text }]}>{bucketTitle(selected, unit)}</Text>
              <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
                {selected.future
                  ? "Still to come"
                  : selected.sets === 0
                    ? unit === "day"
                      ? "Rest day"
                      : "Nothing logged"
                    : `${selected.sessions} ${selected.sessions === 1 ? "workout" : "workouts"} · ${selected.sets} ${selected.sets === 1 ? "set" : "sets"}`}
              </Text>
            </View>
            {selected.day && selected.sets > 0 && onOpenDay && <Button title="View in History" variant="ghost" onPress={() => onOpenDay(selected.day!)} />}
          </>
        ) : (
          <Text style={[typography.labelSm, { flex: 1, color: colors.textSecondary }]}>Tap a bar to see its details</Text>
        )}
      </View>

      {compare && compare.volumePct != null ? (
        <CompareLine pct={compare.volumePct} against={compare.against} />
      ) : note ? (
        <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{note}</Text>
      ) : null}
    </View>
  );
}

const Bar = memo(function Bar({
  bucket,
  height,
  selected,
  title,
  onPress,
}: {
  bucket: ActivityBucket;
  height: number;
  selected: boolean;
  title: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const h = useSharedValue(reduceMotion ? height : 0);
  useEffect(() => {
    h.value = reduceMotion ? height : withTiming(height, { duration: motion.revealMs, easing: Easing.out(Easing.cubic) });
  }, [height, reduceMotion, h]);
  const barStyle = useAnimatedStyle(() => ({ height: h.value }));

  const highlight = selected || bucket.current;
  const label = `${title}: ${bucket.future ? "still to come" : `${bucket.sets} ${bucket.sets === 1 ? "set" : "sets"}`}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityHint="Shows details below the chart"
      style={{ flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end" }}
    >
      {bucket.sets > 0 ? (
        <>
          <Text style={[typography.labelSm, { fontSize: size.chartLabel, marginBottom: spacing.xs, color: highlight ? colors.accent : colors.textSecondary }]} numberOfLines={1}>
            {bucket.sets}
          </Text>
          <Animated.View
            style={[
              {
                width: "100%",
                maxWidth: size.barMax,
                borderTopLeftRadius: radius.md,
                borderTopRightRadius: radius.md,
                borderBottomLeftRadius: radius.sm,
                borderBottomRightRadius: radius.sm,
                backgroundColor: highlight ? colors.accent : colors.accentContainer,
                borderWidth: selected ? 1 : 0,
                borderColor: colors.text,
              },
              barStyle,
            ]}
          />
        </>
      ) : (
        <View
          style={{
            width: "100%",
            maxWidth: size.barMax,
            height: size.restPill,
            borderRadius: radius.full,
            backgroundColor: bucket.future ? "transparent" : selected ? colors.surfaceContainerHighest : colors.surfaceContainerHigh,
            borderWidth: bucket.future || selected ? 1 : 0,
            borderColor: selected ? colors.textSecondary : colors.border,
          }}
        />
      )}
    </Pressable>
  );
});

/** "Volume up 12% vs the same days last week". Neutral wording: a lighter week can be planned. */
function CompareLine({ pct, against }: { pct: number; against: string }) {
  const { colors } = useTheme();
  const icon = pct > 0 ? "trending-up" : pct < 0 ? "trending-down" : "trending-flat";
  const tint = pct > 0 ? colors.trendGood : pct < 0 ? colors.trendBad : colors.textSecondary;
  const span = against === "the 3 months before" ? against : `the same days ${against}`;
  const text = pct === 0 ? `Volume level with ${span}` : `Volume ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% vs ${span}`;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <MaterialIcons name={icon} size={size.iconSm} color={tint} />
      <Text style={[typography.labelMd, { flex: 1, color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}
