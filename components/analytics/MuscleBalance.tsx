import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { displayCategory } from "../../hooks/logSession";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { WEEKLY_SETS_RANGE, type MuscleWeek } from "../../utils/analytics";
import type { BodyMapGroup } from "../muscle/musclePaths";
import { BodyMap, BodyMapLegend, muscleTone, type GroupState } from "./BodyMap";

export type MuscleBalanceProps = {
  rows: MuscleWeek[];
  /** "This week" counts sets so far; longer periods show a weekly average. */
  average: boolean;
  /** Sets outside the six groups (Full Body, Cardio), so they aren't silently missing. */
  others?: { category: string; sets: number }[];
  /** The period's exercises per category, shown when a group is tapped. */
  exercises: Map<string, { exercise: string; sets: number }[]>;
  onOpenExercise: (name: string) => void;
};

/** Trained this long ago (or more) reads as a gap. */
const STALE_DAYS = 7;
const COLUMNS = 3;

/**
 * A body map (front and back) with each muscle group in coral: the more sets
 * a week, the stronger the colour (coral at the common 10–20 guide). An amber
 * outline marks a group trained before but not for a week or more. Tap a
 * muscle, or a group below the map, to see its exercises.
 */
export function MuscleBalance({ rows, average, others = [], exercises, onOpenExercise }: MuscleBalanceProps) {
  const { colors } = useTheme();
  const ordered = [...rows].sort((a, b) => order(a.category) - order(b.category));
  const [open, setOpen] = useState<string | null>(null);
  const list = open ? (exercises.get(open) ?? []) : [];
  const valueOf = (r: MuscleWeek) => (average ? r.perWeek : r.sets);
  const mapState: Partial<Record<BodyMapGroup, GroupState>> = {};
  for (const r of rows) mapState[r.category as BodyMapGroup] = { value: valueOf(r), stale: r.daysSince != null && r.daysSince >= STALE_DAYS };
  const toggle = (c: string) => setOpen((cur) => (cur === c ? null : c));

  return (
    <View style={{ backgroundColor: colors.raised, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.lg }}>
      <View style={{ gap: spacing.xxs }}>
        <Text style={[typography.headlineSm, { color: colors.text }]} accessibilityRole="header">
          Muscle balance
        </Text>
        <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{average ? "Average sets a week per muscle group" : "Sets per muscle group this week"}</Text>
      </View>

      <BodyMap groups={mapState} selected={open as BodyMapGroup | null} onSelect={toggle} />
      <BodyMapLegend />

      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: spacing.xs }}>
        {ordered.map((r) => {
          const name = displayCategory(r.category);
          const value = valueOf(r);
          const stale = r.daysSince != null && r.daysSince >= STALE_DAYS;
          const selected = open === r.category;
          return (
            <Pressable
              key={r.category}
              onPress={() => toggle(r.category)}
              style={({ pressed }) => ({
                width: `${100 / COLUMNS}%`,
                minHeight: size.control,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.lg,
                backgroundColor: selected || pressed ? colors.surfaceContainerHigh : "transparent",
              })}
              accessibilityRole="button"
              accessibilityState={{ expanded: selected }}
              accessibilityLabel={`${name}: ${value} sets${average ? " a week" : ""}. ${sinceText(r.daysSince)}`}
              accessibilityHint="Shows this group's exercises"
            >
              <View style={{ width: size.statusDot + spacing.xs, height: size.statusDot + spacing.xs, borderRadius: radius.full, backgroundColor: muscleTone(colors, value), borderWidth: stale ? 1.5 : 0, borderColor: colors.amber }} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.labelLg, { color: colors.text }]} numberOfLines={1}>
                  {name} <Text style={{ color: colors.textSecondary }}>{value}</Text>
                </Text>
                <Text style={[typography.labelSm, { fontSize: size.chartLabel, color: stale ? colors.amber : colors.textSecondary }]} numberOfLines={1}>
                  {sinceText(r.daysSince)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Tapped group: its exercises this period */}
      {open && (
        <View style={{ borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh, overflow: "hidden" }}>
          <Text style={[typography.labelMd, { color: colors.textSecondary, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs }]}>
            {displayCategory(open)}: {list.length === 0 ? "nothing logged in this period" : `${list.length} ${list.length === 1 ? "exercise" : "exercises"}`}
          </Text>
          {list.map((e) => (
            <Pressable
              key={e.exercise}
              onPress={() => onOpenExercise(e.exercise)}
              accessibilityRole="button"
              accessibilityLabel={`${e.exercise}, ${e.sets} sets`}
              accessibilityHint="Opens this exercise's progress"
              style={({ pressed }) => ({
                minHeight: size.control,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                backgroundColor: pressed ? colors.surfaceContainerHighest : "transparent",
              })}
            >
              <Text style={[typography.bodyMd, { flex: 1, color: colors.text }]} numberOfLines={1}>
                {e.exercise}
              </Text>
              <Text style={[typography.labelMd, { color: colors.textSecondary }]}>
                {e.sets} {e.sets === 1 ? "set" : "sets"}
              </Text>
              <MaterialIcons name="chevron-right" size={size.iconSm} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      )}

      {others.length > 0 && (
        <Text style={[typography.labelMd, { color: colors.textSecondary }]}>
          Also logged: {others.map((o) => `${displayCategory(o.category)} · ${o.sets} ${o.sets === 1 ? "set" : "sets"}`).join(", ")}
        </Text>
      )}

      <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
        Coral marks {WEEKLY_SETS_RANGE.low}–{WEEKLY_SETS_RANGE.high} sets a week, a common guide for building muscle; fewer is fine when you&apos;re starting out. An amber outline means a group hasn&apos;t been trained for a week or more.
      </Text>
    </View>
  );
}

const ORDER = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Abs"];
const order = (c: string) => {
  const i = ORDER.indexOf(c);
  return i < 0 ? ORDER.length : i;
};

function sinceText(days: number | null) {
  if (days == null) return "Not trained yet";
  if (days === 0) return "Trained today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export default MuscleBalance;
