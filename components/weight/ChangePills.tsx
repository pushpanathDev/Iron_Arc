import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { signed } from "./weightChange";
import type { TrendRange } from "./WeightTrendChart";
import type { BodyWeight } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { toDisplay, towardGoal } from "../../utils/bodyWeightRules";
import { weightLabel, type WeightUnit } from "../../utils/unitConversion";
import { shortDate } from "../../utils/dates";

export function changeCaption(first: BodyWeight | null, latest: BodyWeight | null, goalKg: number | null) {
  if (!first || !latest || first === latest) return "Log more days";
  const toward = towardGoal(first.weight, latest.weight, goalKg);
  if (toward != null) return toward ? "Toward goal" : "Away from goal";
  return `since ${shortDate(first.date)}`;
}

export function ChangePill({ deltaKg, days, sinceDate, unit, color }: { deltaKg: number; days: number; sinceDate: string; unit: WeightUnit; color: string }) {
  const { colors } = useTheme();
  const delta = toDisplay(deltaKg, unit);
  const when = days >= 30 ? "in 30 days" : `since ${shortDate(sinceDate)}`;
  return (
    <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHighest }}>
      <MaterialIcons name={delta < 0 ? "trending-down" : delta > 0 ? "trending-up" : "trending-flat"} size={size.iconSm} color={color} />
      <Text style={[typography.labelMd, { color }]}>
        {signed(delta)} {weightLabel(unit)} {when}
      </Text>
    </View>
  );
}

/** "+0.8 kg · 30D · toward goal": change across the range on the chart (goal wording only when one is set). */
export function RangeChangePill({ deltaKg, toward, range, unit, color }: { deltaKg: number; toward: boolean | null; range: TrendRange; unit: WeightUnit; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHighest }}>
      <Text style={[typography.labelMd, { color }]}>{`${signed(toDisplay(deltaKg, unit))} ${weightLabel(unit)} · ${range}${toward == null ? "" : toward ? " · toward goal" : " · away from goal"}`}</Text>
    </View>
  );
}
