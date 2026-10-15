import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Card } from "../ui";
import { planDayShortName, type PlanDay } from "../../utils/planData";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { WEEKDAYS } from "./homeShared";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MAX_UPCOMING = 3;

export function YourPlanCard({ planId, name, weekNumber, days }: { planId: string; name: string; weekNumber: number; days: PlanDay[] }) {
  const { colors } = useTheme();
  // Next training days after today, following the plan's weekday template.
  const todayIndex = new Date().getDay();
  const upcoming: string[] = [];
  for (let i = 1; i <= 7 && upcoming.length < MAX_UPCOMING; i++) {
    const idx = (todayIndex + i) % 7;
    const day = days.find((d) => d.day?.toLowerCase() === WEEKDAYS[idx] && d.sessionType !== "rest");
    if (day) upcoming.push(`${WEEKDAY_SHORT[idx]} · ${planDayShortName(day)}`);
  }

  return (
    <Card
      onPress={() => router.push({ pathname: "/plan-detail", params: { id: planId } })}
      accessibilityLabel={`Your plan: ${name}, week ${weekNumber}. Next: ${upcoming.join(", ") || "no sessions scheduled"}`}
      accessibilityHint="Opens your plan"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <View>
            <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>Your plan · Week {weekNumber}</Text>
            <Text style={[typography.bodyMdMedium, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
          </View>
          {upcoming.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.inline }}>
              {upcoming.map((label) => (
                <View key={label} style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh }}>
                  <Text style={[typography.labelSm, { color: colors.text }]}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={size.icon} color={colors.textSecondary} />
      </View>
    </Card>
  );
}

/** Home's permanent entry to AI plans when none is active. */
export function AIPlanCard({ savedPlans, weeklyGoal }: { savedPlans: number; weeklyGoal: number | null }) {
  const { colors } = useTheme();
  const title = savedPlans > 0 ? "Pick your active plan" : "Build your AI plan";
  const subtitle =
    savedPlans > 0
      ? `You have ${savedPlans} saved ${savedPlans === 1 ? "plan" : "plans"}. Activate one to follow it here.`
      : weeklyGoal
        ? `A week of sessions built around your ${weeklyGoal} training ${weeklyGoal === 1 ? "day" : "days"}.`
        : "A week of sessions built from your profile and recent workouts.";
  return (
    <Card onPress={() => router.navigate("/ai-plan")} accessibilityLabel={`${title}. ${subtitle}`} accessibilityHint="Opens AI plans">
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
          <Ionicons name="sparkles" size={size.icon} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>AI plan</Text>
          <Text style={[typography.headlineSm, { color: colors.text }]}>{title}</Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={size.icon} color={colors.textSecondary} />
      </View>
    </Card>
  );
}
