import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import type { BestLift } from "../../utils/analytics";
import { displayWeightRounded } from "../../utils/exerciseHistory";
import { weightLabel, type WeightUnit } from "../../utils/unitConversion";
import { parseLocalDate } from "../../utils/weekUtils";

const COLLAPSED = 4;

export type BestLiftsCardProps = {
  lifts: BestLift[];
  unit: WeightUnit;
  /** "this week", "this month", …; null for All (every PR would be "new", so no stars). */
  periodPhrase: string | null;
  onOpenExercise: (name: string) => void;
};

/** Heaviest lift per exercise; a star marks exercises with a new PR in the selected period. */
export function BestLiftsCard({ lifts, unit, periodPhrase, onOpenExercise }: BestLiftsCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const stars = periodPhrase != null;
  const newCount = lifts.filter((l) => l.prInPeriod).length;
  const shown = expanded ? lifts : lifts.slice(0, COLLAPSED);
  const canExpand = lifts.length > COLLAPSED;

  return (
    <View style={{ backgroundColor: colors.raised, borderRadius: radius.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: canExpand ? spacing.xs : spacing.lg }}>
      <View style={{ gap: spacing.xxs, marginBottom: spacing.sm }}>
        <Text style={[typography.headlineSm, { color: colors.text }]} accessibilityRole="header">
          Best lifts
        </Text>
        <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>
          {lifts.length === 0
            ? "Log a weighted exercise to see your best lifts"
            : !stars
              ? "Your heaviest lift per exercise"
              : newCount > 0
              ? `Your heaviest lift per exercise · ${newCount} new ${periodPhrase}`
              : `Your heaviest lift per exercise · none new ${periodPhrase}`}
        </Text>
      </View>

      {shown.map((l, i) => {
        const date = parseLocalDate(l.date).toLocaleDateString(undefined, { day: "numeric", month: "short" });
        const weight = displayWeightRounded(l.set.weight, unit);
        return (
          <Pressable
            key={l.exercise}
            onPress={() => onOpenExercise(l.exercise)}
            accessibilityRole="button"
            accessibilityHint="Opens this exercise's progress"
            accessibilityLabel={`${l.exercise}: ${weight} ${weightLabel(unit)} for ${l.set.reps} reps, ${date}${stars && l.prInPeriod ? `, new record ${periodPhrase}` : ""}`}
            style={({ pressed }) => ({
              minHeight: size.exerciseRow,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              marginHorizontal: -spacing.lg,
              paddingHorizontal: spacing.lg,
              borderTopWidth: i === 0 ? 0 : size.divider,
              borderTopColor: colors.surfaceContainerHigh,
              backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent",
            })}
          >
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                <Text style={[typography.bodyMdMedium, { flexShrink: 1, color: colors.text }]} numberOfLines={1}>
                  {l.exercise}
                </Text>
                {stars && l.prInPeriod && <MaterialIcons name="star" size={size.iconXs} color={colors.amber} />}
              </View>
              <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{date}</Text>
            </View>
            <Text style={[typography.headlineSm, { color: colors.text }]}>
              {weight}
              <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
                {" "}
                {weightLabel(unit)} × {l.set.reps}
              </Text>
            </Text>
            <MaterialIcons name="chevron-right" size={size.iconSm} color={colors.textSecondary} />
          </Pressable>
        );
      })}

      {canExpand && (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={({ pressed }) => ({
            minHeight: size.control,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.xs,
            borderRadius: radius.lg,
            borderTopWidth: size.divider,
            borderTopColor: colors.surfaceContainerHigh,
            backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent",
          })}
        >
          <Text style={[typography.labelLg, { color: colors.textSecondary }]}>{expanded ? "Show less" : `See all ${lifts.length}`}</Text>
          <MaterialIcons name={expanded ? "expand-less" : "expand-more"} size={size.iconSm} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}
