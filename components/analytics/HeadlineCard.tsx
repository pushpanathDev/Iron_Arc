import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import type { Headline } from "../../utils/analytics";
import { ProgressRing } from "../ui/ProgressRing";

export type HeadlineCardProps = {
  headline: Headline;
  /** "This week", "This month", … */
  overline: string;
  workouts: number;
  records: number;
  sets: number;
  /** Week with a plan: training days done of planned. */
  plan?: { done: number; goal: number } | null;
};

/**
 * The period at a glance: a sentence picked from the user's own data, the
 * week's planned-days ring, and the three numbers that matter.
 */
export function HeadlineCard({ headline, overline, workouts, records, sets, plan }: HeadlineCardProps) {
  const { colors } = useTheme();
  const tint = { record: colors.amber, good: colors.trendGood, warning: colors.warning, neutral: colors.accent }[headline.tone];

  return (
    <View style={{ borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: headline.tone === "record" ? colors.amber : colors.accentSubtle }}>
      <LinearGradient
        colors={[colors.accentSubtle, colors.accentTint, colors.raised]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <MaterialIcons name={headline.icon} size={size.iconSm} color={tint} />
            <Text style={[typography.labelMd, { color: tint, textTransform: "uppercase", letterSpacing: tracking.overline }]}>{overline}</Text>
          </View>
          <Text style={[typography.headlineMd, { color: colors.text }]} accessibilityRole="header">
            {headline.text}
          </Text>
          {headline.detail ? <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{headline.detail}</Text> : null}
        </View>

        {plan ? (
          <ProgressRing
            progress={plan.goal > 0 ? plan.done / plan.goal : 0}
            size={size.homeRing}
            strokeWidth={size.ringSmStroke + 2}
            trackColor={colors.surfaceContainerHigh}
            accessibilityLabel={`${plan.done} of ${plan.goal} planned training days`}
          >
            <Text style={[typography.headlineSm, { color: colors.text }]}>
              {plan.done}/{plan.goal}
            </Text>
            <Text style={[typography.labelSm, { fontSize: size.chartLabel, color: colors.textSecondary }]}>days</Text>
          </ProgressRing>
        ) : (
          <View style={{ width: size.iconBadge, height: size.iconBadge, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
            <MaterialIcons name={headline.icon} size={size.iconLg + spacing.sm} color={tint} />
          </View>
        )}
      </View>

      {/* The numbers */}
      <View style={{ flexDirection: "row", borderTopWidth: size.divider, borderTopColor: colors.border }}>
        <Stat label="Workouts" value={workouts} />
        <Divider />
        <Stat label="Records" value={records} star={records > 0} />
        <Divider />
        <Stat label="Sets" value={sets} />
      </View>
    </View>
  );
}

function Stat({ label, value, star }: { label: string; value: number; star?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", paddingVertical: spacing.md, gap: spacing.xxs }} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Text style={[typography.headlineLg, { color: star ? colors.amber : colors.text }]}>{value}</Text>
        {star && <MaterialIcons name="star" size={size.iconSm} color={colors.amber} />}
      </View>
      <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ width: size.divider, marginVertical: spacing.md, backgroundColor: colors.border }} />;
}

export default HeadlineCard;
