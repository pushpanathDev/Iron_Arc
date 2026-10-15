import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { Card, ProgressRing } from "../ui";
import type { StreakSummary, WeekSummary, WeekVolume } from "../../hooks/useWorkoutSummary";
import { useTheme } from "../../theme/theme";
import { alpha, radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { displayWeight, weightLabel } from "../../utils/unitConversion";
import { useCountUp } from "./homeShared";

const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

export function WeekCard({ week, volume, unit }: { week: WeekSummary; volume: WeekVolume; unit: "kg" | "lbs" }) {
  const { colors } = useTheme();
  const shown = useCountUp(week.daysTrained, true);
  const { goal, met, percent, daysTrained } = week;

  return (
    <Card style={{ flex: 1, gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>This week</Text>
        {percent != null && <Text style={[typography.labelLg, { color: colors.accent }]}>{percent}%</Text>}
      </View>
      {/* Count and ring sit together in the middle of the card's remaining space. */}
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={[typography.headlineMd, { color: colors.text }]}>
            {goal ? `${shown} of ${goal}` : `${shown} ${daysTrained === 1 ? "day" : "days"}`}
          </Text>
          <Text style={[typography.labelSm, { color: met ? colors.accent : colors.textSecondary }]}>{met ? "Goal met" : goal ? "days trained" : "trained"}</Text>
        </View>
        {goal && (
          <ProgressRing
            progress={daysTrained / goal}
            size={size.ringSm}
            strokeWidth={size.ringSmStroke}
            trackColor={colors.surfaceContainerHighest}
            accessibilityLabel={`${daysTrained} of ${goal} training days this week${met ? ", goal met" : ""}`}
          >
            {/* Always shown; lights up once the goal is met. */}
            <MaterialIcons name="check" size={size.iconXs} color={met ? colors.accent : colors.textSecondary} />
          </ProgressRing>
        )}
      </View>
      {volume.thisWeekKg > 0 && (
        <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={2}>
          {`${Math.round(displayWeight(volume.thisWeekKg, unit)).toLocaleString()} ${weightLabel(unit)} lifted`}
          {volume.changePct != null && (
            <Text style={{ color: volume.changePct >= 0 ? colors.trendGood : colors.trendBad }}>
              {` · ${volume.changePct >= 0 ? "+" : "−"}${Math.abs(volume.changePct)}% vs last week`}
            </Text>
          )}
        </Text>
      )}
    </Card>
  );
}

export function StreakCard({ streak, week, todayKey }: { streak: StreakSummary; week: WeekSummary; todayKey: string }) {
  const { colors } = useTheme();
  const shown = useCountUp(streak.current, true);
  const weeksLabel = (n: number) => `${n} ${n === 1 ? "week" : "weeks"}`;
  const plural = (n: number) => `${n} more ${n === 1 ? "day" : "days"} this week`;
  const progress = !week.goal
    ? null
    : week.met
      ? "Week complete"
      : `${plural(week.remaining)} to ${streak.current > 0 ? "keep it" : "start one"}`;
  const a11y = [
    streak.current > 0 ? `${streak.current} week streak.` : "No streak yet.",
    streak.best > streak.current ? `Best ${weeksLabel(streak.best)}.` : "",
    week.goal ? `${week.daysTrained} of ${week.goal} days this week.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card style={{ flex: 1, justifyContent: "space-between", gap: spacing.sm }} accessibilityLabel={a11y}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <MaterialIcons name="local-fire-department" size={size.iconSm} color={colors.warning} />
        <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>Streak</Text>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.headlineMd, { color: streak.current > 0 ? colors.warning : colors.textSecondary }]}>
          {streak.current > 0 ? weeksLabel(shown) : "Start a streak"}
        </Text>
        {streak.best > streak.current && (
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Best: {weeksLabel(streak.best)}</Text>
        )}
        {progress && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            {week.met && <MaterialIcons name="check" size={size.iconXs} color={colors.accent} />}
            <Text style={[typography.labelSm, { color: week.met ? colors.accent : colors.textSecondary, flexShrink: 1 }]}>{progress}</Text>
          </View>
        )}
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {week.dates.map((date, i) => {
            const isToday = date === todayKey;
            const future = date > todayKey;
            const trained = week.trained[i];
            return (
              <View key={date} style={{ alignItems: "center", gap: spacing.xs }}>
                <Text style={[isToday ? typography.labelMd : typography.labelSm, { color: isToday ? colors.warning : colors.textSecondary }]}>{WEEK_LETTERS[i]}</Text>
                <View
                  style={{
                    width: size.goalDot,
                    height: size.goalDot,
                    borderRadius: radius.full,
                    backgroundColor: trained ? colors.warning : future || isToday ? "transparent" : colors.surfaceContainerHigh,
                    borderWidth: trained ? 0 : size.divider,
                    borderColor: isToday && !trained ? colors.warning : colors.border,
                    opacity: future ? alpha.half : 1,
                  }}
                />
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}
