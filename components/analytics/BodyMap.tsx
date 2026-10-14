import { memo } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { BODY_MAP, HEAD, SILHOUETTE, toPath, VIEWBOX, type BodyMapGroup } from "../muscle/musclePaths";
import type { ColorTokens } from "../../theme/tokens";
import { useTheme } from "../../theme/theme";
import { size, spacing, typography } from "../../theme/tokens";

const SILHOUETTE_PATHS = SILHOUETTE.map(toPath);
const OUTLINE = 0.6;
const STALE_OUTLINE = 1.4;

export type GroupState = {
  /** Sets (this week, or a weekly average). */
  value: number;
  /** Trained before but not in 7+ days: amber outline. */
  stale: boolean;
};

/** More sets → stronger coral; none → the plain body grey. */
export function muscleTone(colors: ColorTokens, sets: number): string {
  if (sets <= 0) return colors.surfaceContainerHighest;
  if (sets < 5) return colors.muscleLow;
  if (sets < 10) return colors.muscleMid;
  if (sets <= 20) return colors.muscleTarget;
  return colors.muscleHigh;
}

/**
 * Front and back figures with each main muscle group coloured by its sets.
 * Tapping a muscle selects its group (rows below the map do the same, with
 * full-size touch targets).
 */
export const BodyMap = memo(function BodyMap({
  groups,
  selected,
  onSelect,
}: {
  groups: Partial<Record<BodyMapGroup, GroupState>>;
  selected: BodyMapGroup | null;
  onSelect: (g: BodyMapGroup) => void;
}) {
  const { colors } = useTheme();
  const figure = (view: "front" | "back", label: string) => (
    <View style={{ flex: 1, alignItems: "center", gap: spacing.xs }}>
      <Svg width="100%" height={size.trendChart} viewBox={VIEWBOX} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill={colors.surfaceContainerHigh} />
        {SILHOUETTE_PATHS.map((d, i) => (
          <Path key={`s${i}`} d={d} fill={colors.surfaceContainerHigh} stroke={colors.surfaceContainerHigh} strokeWidth={1.2} strokeLinejoin="round" />
        ))}
        {BODY_MAP[view].map(({ group, shapes }) => {
          const g = groups[group];
          const isSelected = selected === group;
          const stroke = isSelected ? colors.text : g?.stale ? colors.amber : colors.surfaceContainerHigh;
          return (
            <G key={group} onPress={() => onSelect(group)}>
              {shapes.map((d, i) => (
                <Path
                  key={i}
                  d={d}
                  fill={muscleTone(colors, g?.value ?? 0)}
                  stroke={stroke}
                  strokeWidth={isSelected || g?.stale ? STALE_OUTLINE : OUTLINE}
                  strokeLinejoin="round"
                />
              ))}
            </G>
          );
        })}
      </Svg>
      <Text style={[typography.labelSm, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      {figure("front", "Front")}
      {figure("back", "Back")}
    </View>
  );
});

/** The scale under the map: grey, then four coral steps. */
export function BodyMapLegend() {
  const { colors } = useTheme();
  const steps: [number, string][] = [
    [0, "0"],
    [1, "1–4"],
    [5, "5–9"],
    [10, "10–20"],
    [21, "20+"],
  ];
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", gap: spacing.xxs }}>
        {steps.map(([v, label]) => (
          <View key={label} style={{ flex: 1, gap: spacing.xxs }}>
            <View style={{ height: size.progressBar * 2, borderRadius: spacing.xxs, backgroundColor: muscleTone(colors, v) }} />
            <Text style={[typography.labelSm, { fontSize: size.chartLabel, color: colors.textSecondary, textAlign: "center" }]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
