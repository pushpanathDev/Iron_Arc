import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { BodyWeight } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { size, spacing, tracking, typography } from "../../theme/tokens";
import { changeOver, formatValue, goalProgress, toDisplay } from "../../utils/bodyWeightRules";
import { weightLabel, type WeightUnit } from "../../utils/unitConversion";
import { Card } from "../ui/Card";
import { deltaColor, signed } from "../weight/weightChange";

const SPARK_DAYS = 30;
const DAY_MS = 86_400_000;
const DOT = 3;

export type WeightSnapshotCardProps = {
  /** Newest first or any order; sorted here. */
  entries: BodyWeight[];
  unit: WeightUnit;
  goalKg: number | null;
  fitnessGoal: string | null | undefined;
};

/** Home's link to the Weight screen: latest weight, 30-day change, goal progress, sparkline. */
export function WeightSnapshotCard({ entries, unit, goalKg, fitnessGoal }: WeightSnapshotCardProps) {
  const { colors } = useTheme();
  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const latest = sorted[sorted.length - 1] ?? null;
  const change = changeOver(sorted);
  const progress = latest && goalKg != null ? goalProgress(latest.weight, goalKg) : null;
  const open = () => router.navigate("/(tabs)/body-weight");

  if (!latest) {
    return (
      <Card onPress={open} accessibilityLabel="Body weight: no weigh-ins yet" accessibilityHint="Opens Weight">
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>Body weight</Text>
            <Text style={[typography.headlineSm, { color: colors.text }]}>Log your first weigh-in</Text>
          </View>
          <MaterialIcons name="chevron-right" size={size.icon} color={colors.textSecondary} />
        </View>
      </Card>
    );
  }

  const value = formatValue(toDisplay(latest.weight, unit));
  const changeText = change ? `${signed(toDisplay(change.deltaKg, unit))} ${weightLabel(unit)} · ${change.days >= 30 ? "30 days" : `${change.days} ${change.days === 1 ? "day" : "days"}`}` : null;
  const changeColor = change ? deltaColor(latest.weight - change.deltaKg, latest.weight, goalKg, fitnessGoal, colors) : colors.textSecondary;
  const goalText =
    goalKg == null
      ? "No goal set"
      : progress?.reached
        ? "At goal"
        : `${formatValue(toDisplay(progress!.leftKg, unit))} ${weightLabel(unit)} to ${progress!.direction}`;

  return (
    <Card
      onPress={open}
      accessibilityLabel={`Body weight ${value} ${weightLabel(unit)}${changeText ? `, ${changeText}` : ""}. ${goalText}`}
      accessibilityHint="Opens Weight"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>Body weight</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xs }}>
            <Text style={[typography.headlineLg, { color: colors.text }]}>{value}</Text>
            <Text style={[typography.labelLg, { color: colors.textSecondary }]}>{weightLabel(unit)}</Text>
          </View>
          {changeText && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
              <MaterialIcons name={change!.deltaKg < 0 ? "arrow-drop-down" : change!.deltaKg > 0 ? "arrow-drop-up" : "remove"} size={size.iconSm} color={changeColor} />
              <Text style={[typography.labelMd, { color: changeColor }]}>{changeText}</Text>
            </View>
          )}
          <Text style={[typography.labelSm, { color: goalKg == null ? colors.textSecondary : colors.warning }]}>{goalText}</Text>
        </View>
        <Sparkline entries={sorted} />
        <MaterialIcons name="chevron-right" size={size.icon} color={colors.textSecondary} />
      </View>
    </Card>
  );
}

/** The last 30 days as a small line (decorative; the numbers carry the meaning). */
function Sparkline({ entries }: { entries: BodyWeight[] }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const height = size.control;
  const points = useMemo(() => {
    if (entries.length < 2 || width === 0) return null;
    const last = Date.parse(`${entries[entries.length - 1].date.slice(0, 10)}T00:00:00`);
    const recent = entries.filter((e) => Date.parse(`${e.date.slice(0, 10)}T00:00:00`) > last - SPARK_DAYS * DAY_MS);
    if (recent.length < 2) return null;
    const vals = recent.map((e) => e.weight);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo || 1;
    return recent.map((e, i) => ({
      x: DOT + (i / (recent.length - 1)) * (width - DOT * 2),
      y: DOT + (1 - (e.weight - lo) / span) * (height - DOT * 2),
    }));
  }, [entries, width, height]);

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{ width: size.goalCard - spacing.xl, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {points && (
        <Svg width={width} height={height}>
          <Path d={points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ")} stroke={colors.accent} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={DOT} fill={colors.accent} />
        </Svg>
      )}
    </View>
  );
}

export default WeightSnapshotCard;
