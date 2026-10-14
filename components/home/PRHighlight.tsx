import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { formatSet, prGain, type RecentPR } from "../../utils/exerciseHistory";
import type { WeightUnit } from "../../utils/unitConversion";
import { Card } from "../ui/Card";

/** "New PR this week": shown only when the last 7 days have a real record. */
export function PRHighlight({ prs, unit }: { prs: RecentPR[]; unit: WeightUnit }) {
  const { colors } = useTheme();
  if (prs.length === 0) return null;
  const top = prs[0];
  const more = prs.length - 1;
  const lift = formatSet(top.set, unit);
  const detail = `${prGain(top.set, top.previous, top.kind, unit)} over ${formatSet(top.previous, unit)}`;

  return (
    <Card accessibilityLabel={`New personal record this week: ${top.exercise}, ${lift}. ${detail}${more ? `. ${more} more` : ""}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
          <MaterialIcons name="emoji-events" size={size.iconLg} color={colors.warning} />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text style={[typography.labelSm, { color: colors.warning, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>
            {prs.length === 1 ? "New PR this week" : `${prs.length} new PRs this week`}
          </Text>
          <Text style={[typography.headlineSm, { color: colors.text }]} numberOfLines={1}>
            {`${top.exercise} · ${lift}`}
          </Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={1}>
            {more > 0 ? `${detail} · +${more} more` : detail}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export default PRHighlight;
