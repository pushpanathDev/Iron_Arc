import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { ActivityChart } from "../../components/analytics/ActivityChart";
import { BestLiftsCard } from "../../components/analytics/BestLiftsCard";
import { HeadlineCard } from "../../components/analytics/HeadlineCard";
import { MuscleBalance } from "../../components/analytics/MuscleBalance";
import { RecordsCard } from "../../components/analytics/RecordsCard";
import { useAuth } from "../../providers/AuthContext";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { FilterChip } from "../../components/ui/FilterChip";
import { Reveal } from "../../components/ui/Reveal";
import { SkeletonBlock } from "../../components/ui/Skeleton";
import { effectiveWeeklyGoal } from "../../data/trainingProfile";
import { useProfile } from "../../hooks/useProfile";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useAllWorkouts } from "../../hooks/useWorkouts";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { analyzePeriod, bestLifts, exercisesByCategory, headlineFor, MAIN_GROUPS, muscleWeeks, PERIODS, prsInRange, withinReach, type AnalyticsPeriod } from "../../utils/analytics";
import { getInitials } from "../../utils/avatar";
import { exerciseIndexFor, prEventsFor } from "../../utils/exerciseHistory";
import { perfStart } from "../../utils/perf";
import { toKg, weightLabel, weightStep } from "../../utils/unitConversion";
import { formatDate, parseLocalDate } from "../../utils/dates";
import type { MaterialIconName } from "../../components/ui/iconName";

const NO_WORKOUTS: never[] = [];

/** Label over the hero card. */
const OVERLINE: Record<AnalyticsPeriod, string> = { week: "This week", month: "This month", quarter: "Last 3 months", all: "All time" };

/** How each period reads in a sentence ("52 sets this week"). */
const PHRASE: Record<AnalyticsPeriod, string> = {
  week: "this week",
  month: "this month",
  quarter: "in the last 3 months",
  all: "so far",
};

export default function Analytics() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { unit } = useUnitPreference();
  const query = useAllWorkouts();
  const workouts = query.data ?? NO_WORKOUTS;
  const todayKey = formatDate(new Date());

  const [period, setPeriod] = useState<AnalyticsPeriod>("week");
  const [refreshing, setRefreshing] = useState(false);

  const stats = useMemo(() => analyzePeriod(workouts, period, todayKey), [workouts, period, todayKey]);
  const lifts = useMemo(() => bestLifts(exerciseIndexFor(workouts).index, stats.start, stats.end), [workouts, stats.start, stats.end]);
  const records = useMemo(() => prsInRange(prEventsFor(workouts), stats.start, stats.end), [workouts, stats.start, stats.end]);
  const reach = useMemo(() => withinReach(exerciseIndexFor(workouts).index, todayKey, toKg(weightStep(unit), unit)), [workouts, todayKey, unit]);
  const muscles = useMemo(() => muscleWeeks(workouts, stats, todayKey), [workouts, stats, todayKey]);
  const groupExercises = useMemo(() => exercisesByCategory(workouts, stats.start, stats.end), [workouts, stats.start, stats.end]);
  const headline = useMemo(() => headlineFor(workouts, period, stats, records, todayKey, PHRASE[period], unit), [workouts, period, stats, records, todayKey, unit]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const phrase = PHRASE[period];
  const goal = effectiveWeeklyGoal(profile);
  // Planned weekdays (ISO 1 = Monday) marked on the week chart.
  const plannedDays = useMemo(() => {
    const days = profile?.trainingDays ?? [];
    return period === "week" ? new Set(stats.buckets.filter((_, i) => days.includes(i + 1)).map((b) => b.key)) : undefined;
  }, [profile?.trainingDays, period, stats.buckets]);
  const openExercise = (name: string) => router.push({ pathname: "/exercise/[name]", params: { name } });
  const chartSubtitle =
    period === "week" && goal
      ? `${stats.trainingDays} of ${goal} planned ${goal === 1 ? "day" : "days"} · ${stats.sets} ${stats.sets === 1 ? "set" : "sets"}`
      : `${stats.sessions} ${stats.sessions === 1 ? "workout" : "workouts"} · ${stats.sets} ${stats.sets === 1 ? "set" : "sets"} ${phrase}`;
  const chartNote =
    period !== "all"
      ? null
      : stats.chartTruncated
        ? "The chart shows the last 12 months; totals cover everything."
        : `Since ${parseLocalDate(stats.start).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;

  const nameSource = profile?.displayName || user?.displayName || profile?.email || user?.email || "";
  const avatarPhoto = profile?.avatarUrl || user?.photoURL || null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: spacing.screen, paddingRight: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ width: size.tileSm, height: size.tileSm, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
            <MaterialIcons name="insights" size={size.icon} color={colors.accent} />
          </View>
          <Text style={[typography.headlineMd, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
            Analytics
          </Text>
        </View>
        <Avatar key={avatarPhoto ?? "initials"} photoUri={avatarPhoto} initials={nameSource ? getInitials(nameSource) : ""} onPress={() => router.navigate("/(tabs)/profile")} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.card} />}
      >
        {query.isLoading && workouts.length === 0 ? (
          <AnalyticsSkeleton />
        ) : workouts.length === 0 ? (
          <AnalyticsEmpty />
        ) : (
          <>
            {/* Period */}
            <Reveal index={0}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {PERIODS.map((p) => (
                  <FilterChip key={p.key} label={p.label} active={period === p.key} onPress={() => setPeriod(p.key)} />
                ))}
              </ScrollView>
            </Reveal>

            <Reveal index={1}>
              <HeadlineCard
                headline={headline}
                overline={OVERLINE[period]}
                workouts={stats.sessions}
                records={records.length}
                sets={stats.sets}
                plan={period === "week" && goal ? { done: stats.trainingDays, goal } : null}
              />
            </Reveal>

            <Reveal index={3}>
              <ActivityChart
                title="Activity"
                subtitle={chartSubtitle}
                plannedDays={plannedDays}
                buckets={stats.buckets}
                unit={stats.bucketUnit}
                compare={stats.compare}
                note={chartNote}
                onOpenDay={(date) => router.navigate({ pathname: "/(tabs)/history", params: { date } })}
              />
            </Reveal>

            <Reveal index={4}>
              <RecordsCard records={records} reach={reach} unit={unit} periodPhrase={period === "all" ? null : phrase} onOpenExercise={openExercise} />
            </Reveal>

            <Reveal index={5}>
              <MuscleBalance rows={muscles} average={period !== "week"} others={stats.balance.filter((r) => r.sets > 0 && !(MAIN_GROUPS as readonly string[]).includes(r.category))}
                exercises={groupExercises}
                onOpenExercise={openExercise}
              />
            </Reveal>

            <Reveal index={6}>
              <BestLiftsCard lifts={lifts} unit={unit} periodPhrase={period === "all" ? null : phrase} onOpenExercise={openExercise} />
            </Reveal>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Pieces

const PREVIEWS: { icon: MaterialIconName; title: string; value: string; body: string }[] = [
  { icon: "bar-chart", title: "Volume & load", value: "--", body: "Total weight lifted each week, across all exercises" },
  { icon: "pie-chart-outline", title: "Muscle balance", value: "-- %", body: "How your sets split across chest, back, legs and more" },
  { icon: "workspace-premium", title: "Personal records", value: "Pending", body: "Your heaviest lift for every exercise, new records starred" },
];

/** No workouts at all (Analytics_Empty_Data mockup). */
function AnalyticsEmpty() {
  const { colors } = useTheme();
  const { unit } = useUnitPreference();
  return (
    <>
      <Reveal index={0}>
        <View style={{ alignItems: "center", gap: spacing.md, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.raised }}>
          <View style={{ width: size.iconBadge, height: size.iconBadge, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
            <MaterialIcons name="insights" size={size.iconLg} color={colors.accent} />
          </View>
          <View style={{ alignItems: "center", gap: spacing.xs }}>
            <Text style={[typography.headlineSm, { color: colors.text, textAlign: "center", textTransform: "uppercase", letterSpacing: tracking.headlineWide }]}>No workout data yet</Text>
            <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>
              Log a few workouts to see your weekly volume, consistency and progress.
            </Text>
          </View>
          <View style={{ alignSelf: "stretch" }}>
            <Button
              title="Log workout"
              icon="barbell-outline"
              onPress={() => {
                perfStart("open picker");
                router.push("/workout/pick");
              }}
              fullWidth
            />
          </View>
        </View>
      </Reveal>

      <Reveal index={1} style={{ gap: spacing.sm }}>
        <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>What you&apos;ll see here</Text>
        {PREVIEWS.map((p) => (
          <View key={p.title} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised }}>
            <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
              <MaterialIcons name={p.icon} size={size.icon} color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
                <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{p.title}</Text>
                <Text style={[typography.labelMd, { color: p.value === "Pending" ? colors.warning : colors.textSecondary }]}>
                  {p.value === "--" ? `-- ${weightLabel(unit)}` : p.value}
                </Text>
              </View>
              <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{p.body}</Text>
            </View>
          </View>
        ))}
      </Reveal>

      <Reveal index={2} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md }}>
        <MaterialIcons name="info-outline" size={size.iconSm} color={colors.textSecondary} />
        <Text style={[typography.labelSm, { flex: 1, color: colors.textSecondary }]}>Numbers fill in automatically after your first logged workout.</Text>
      </Reveal>
    </>
  );
}

function AnalyticsSkeleton() {
  return (
    <View style={{ gap: spacing.md }} accessibilityLabel="Loading analytics">
      <SkeletonBlock height={size.control} radius="lg" />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {[0, 1, 2].map((k) => (
          <View key={k} style={{ flex: 1 }}>
            <SkeletonBlock height={size.statTile} radius="xl" />
          </View>
        ))}
      </View>
      <SkeletonBlock height={size.trendChart + size.goalCard} radius="xl" />
      <SkeletonBlock height={size.goalCard * 2} radius="xl" />
    </View>
  );
}
