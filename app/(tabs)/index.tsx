import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../providers/AuthContext";
import { EmailVerificationPrompt } from "../../components/auth/EmailVerificationPrompt";
import { CyclingHeadline } from "../../components/home/CyclingHeadline";
import { ResumeWorkoutSheet } from "../../components/workout/ResumeWorkoutSheet";
import { MuscleIcon } from "../../components/muscle/MuscleIcon";
import { Avatar } from "../../components/ui/Avatar";
import { Button, Card, EmptyState, ErrorState, PressableScale, Reveal, StatusPill } from "../../components/ui";
import { verificationMessages } from "../../data/verificationMessages";
import { useConnection } from "../../providers/ConnectionContext";
import { useEmailVerificationGrace } from "../../hooks/useEmailVerificationGrace";
import { usePlan, usePlans } from "../../hooks/usePlan";
import { useProfile } from "../../hooks/useProfile";
import { useAllWeights } from "../../hooks/useWeights";
import { PRHighlight } from "../../components/home/PRHighlight";
import { WeightSnapshotCard } from "../../components/home/WeightSnapshotCard";
import { exerciseIndexFor, recentPRs } from "../../utils/exerciseHistory";
import { getPlanWeekDays } from "../../utils/planData";
import { effectiveWeeklyGoal, isoWeekday } from "../../data/trainingProfile";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useWorkoutSummary } from "../../hooks/useWorkoutSummary";
import { isNetworkApiError } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { radius, semibold, size, spacing, touchTarget, tracking, typography } from "../../theme/tokens";
import { getInitials } from "../../utils/avatar";
import { perfStart } from "../../utils/perf";
import { WEEKDAYS } from "../../components/home/homeShared";
import { TodayCard } from "../../components/home/TodayCard";
import { WeekCard, StreakCard } from "../../components/home/WeekCards";
import { YourPlanCard, AIPlanCard } from "../../components/home/PlanCards";
import { RecentCard } from "../../components/home/RecentCard";
import { HomeSkeleton } from "../../components/home/HomeSkeleton";


export default function Home() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { unit } = useUnitPreference();
  const connection = useConnection();

  const profileQuery = useProfile();
  const profile = profileQuery.data;
  // Training days per week: the chosen weekdays, else the stored count, capped at 6.
  const weeklyGoal = effectiveWeeklyGoal(profile);
  // Is today one of the user's training days? null when they haven't picked days.
  const trainingDayToday = profile?.trainingDays?.length ? profile.trainingDays.includes(isoWeekday(new Date())) : null;
  // Every Home number comes from the one shared workouts query.
  const {
    query: workoutsQuery,
    todayKey,
    sessions,
    todaySession,
    week,
    streak,
    suggestion: suggestedGroup,
    recent,
    volume,
  } = useWorkoutSummary(weeklyGoal);
  const weightsQuery = useAllWeights();
  // PRs from the shared, cached exercise index (built once per workouts change).
  const prs = useMemo(() => recentPRs(exerciseIndexFor(workoutsQuery.data ?? []).index, todayKey), [workoutsQuery.data, todayKey]);
  const plansQuery = usePlans();
  const activePlanMeta = plansQuery.data?.find((p) => p.isActive);
  const activePlanQuery = usePlan(activePlanMeta?.id);

  const [refreshing, setRefreshing] = useState(false);
  const verification = useEmailVerificationGrace(user);
  const daysLeft = verification.daysLeft;
  const [dismissVerificationBanner, setDismissVerificationBanner] = useState(false);

  // Suggested next only without an active plan; the plan card takes its slot.
  const suggestion = activePlanMeta ? null : suggestedGroup;

  const planWeekDays = useMemo(
    () => getPlanWeekDays(activePlanQuery.data?.planData, activePlanQuery.data?.weekNumber),
    [activePlanQuery.data],
  );
  const todayPlanDay = useMemo(() => {
    const todayName = WEEKDAYS[new Date().getDay()];
    return planWeekDays.find((d) => d.day?.toLowerCase() === todayName) ?? null;
  }, [planWeekDays]);

  // Refresh
  const refetchAll = useCallback(async () => {
    await Promise.all([
      workoutsQuery.refetch(),
      profileQuery.refetch(),
      plansQuery.refetch(),
      activePlanMeta ? activePlanQuery.refetch() : Promise.resolve(),
    ]);
  }, [workoutsQuery, profileQuery, plansQuery, activePlanQuery, activePlanMeta]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchAll(), verification.reload()]);
    } catch (error) {
      console.log("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Screen state
  const planLoading = plansQuery.isLoading || (!!activePlanMeta && activePlanQuery.isLoading);
  // Skeleton until EVERYTHING Home shows has loaded (workouts, profile, weights,
  // plan), so the screen appears complete in one go instead of filling in card
  // by card. `isLoading` is only true with no cached data: with saved data the
  // screen renders at once and refreshes in the background (Syncing pill).
  // A query that fails stops loading too, so this can't hang.
  const isLoading = workoutsQuery.isLoading || profileQuery.isLoading || weightsQuery.isLoading || planLoading;
  // Background refresh of data already on screen; the offline banner covers other states.
  const syncing =
    connection.state === "online" &&
    !isLoading &&
    (workoutsQuery.isFetching || profileQuery.isFetching || plansQuery.isFetching || weightsQuery.isFetching);
  const fatalError = workoutsQuery.isError && !workoutsQuery.data ? workoutsQuery.error : null;

  const firstName = (profile?.displayName ?? user?.displayName ?? "").trim().split(/\s+/)[0];
  const avatarPhoto = profile?.avatarUrl || user?.photoURL || null;
  const nameSource = profile?.displayName || user?.displayName || profile?.email || user?.email || "";
  const initials = nameSource ? getInitials(nameSource) : "";

  // Header messages: only those that apply, in this order (max 5).
  const headlines = [
    `${getGreeting()}${firstName ? `, ${firstName}` : ""}`,
    todaySession ? "Nice work today" : "Ready for your session?",
    week.goal ? `${week.daysTrained} of ${week.goal} days this week` : null,
    suggestion ? `${suggestion.label} is up next` : null,
    streak.current >= 1 ? `${streak.current}-week streak` : null,
  ].filter((m): m is string => !!m);

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>
                Dashboard
              </Text>
              {syncing && <StatusPill label="Syncing" dotColor={colors.accent} />}
            </View>
            <CyclingHeadline messages={headlines} />
          </View>
          <Avatar
            key={avatarPhoto ?? "initials"}
            photoUri={avatarPhoto}
            initials={initials}
            onPress={() => router.navigate("/(tabs)/profile")}
          />
        </View>

        {/* Email verification reminder (kept from the old Home) */}
        {user && !user.emailVerified && daysLeft !== null && !dismissVerificationBanner && (
          <Card style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
              <Ionicons
                name="mail-unread-outline"
                size={size.icon}
                color={daysLeft > 0 ? colors.accent : colors.danger}
              />
              <Text style={[typography.bodyLg, { color: colors.text, ...semibold, flex: 1 }]}>
                {daysLeft > 0
                  ? verificationMessages.bannerTitleSoft(daysLeft)
                  : verificationMessages.bannerTitleHard}
              </Text>
              <PressableScale
                onPress={() => setDismissVerificationBanner(true)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss verification reminder"
                style={{ width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", marginTop: -spacing.md, marginRight: -spacing.md }}
              >
                <Ionicons name="close" size={size.icon} color={colors.textSecondary} />
              </PressableScale>
            </View>
            <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{verificationMessages.bannerBody}</Text>
            <Button title={verificationMessages.bannerAction} variant="ghost" onPress={verification.openPrompt} />
          </Card>
        )}

        {/* Fitness goal nudge (kept from the old Home) */}
        {profile && !profile.fitnessGoal && (
          <Card onPress={() => router.navigate("/(tabs)/profile")} accessibilityLabel="Set your fitness goal. Needed to create your AI workout plan.">
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Ionicons name="sparkles" size={size.icon} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyLg, { color: colors.text, ...semibold }]}>Set your fitness goal</Text>
                <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>Needed to create your AI workout plan</Text>
              </View>
              <Ionicons name="chevron-forward" size={size.icon} color={colors.textSecondary} />
            </View>
          </Card>
        )}

        {isLoading ? (
          <HomeSkeleton />
        ) : fatalError ? (
          <Card>
            {isNetworkApiError(fatalError) ? (
              // The offline banner owns the message and Retry.
              <EmptyState icon="barbell-outline" title="Workouts not loaded yet" body="They'll appear here once you're back online." />
            ) : (
              <ErrorState message="We couldn't load your workouts." onRetry={() => void refetchAll()} retrying={workoutsQuery.isFetching} />
            )}
          </Card>
        ) : (
          <>
            {/* Cards rise in one after another (Reveal: UI-thread transform, taps unaffected). */}
            <Reveal index={0}>
              <TodayCard
                loadingPlan={planLoading}
                planId={activePlanMeta?.id ?? null}
                planDay={activePlanMeta ? todayPlanDay : null}
                hasPlan={!!activePlanMeta}
                todaySession={todaySession}
                nextSessionNumber={sessions.length + 1}
                unit={unit}
                trainingDayToday={trainingDayToday}
              />
            </Reveal>

            {prs.length > 0 && (
              <Reveal index={1}>
                <PRHighlight prs={prs} unit={unit} />
              </Reveal>
            )}

            <Reveal index={2} style={{ flexDirection: "row", gap: spacing.sm }}>
              <WeekCard week={week} volume={volume} unit={unit} />
              <StreakCard streak={streak} week={week} todayKey={todayKey} />
            </Reveal>

            {weightsQuery.data && (
              <Reveal index={3}>
                <WeightSnapshotCard entries={weightsQuery.data} unit={unit} goalKg={profile?.targetWeight ?? null} fitnessGoal={profile?.fitnessGoal} />
              </Reveal>
            )}

            {/* Plan slot: the active plan, or the way to build one (always reachable from Home). */}
            <Reveal index={4}>
              {activePlanMeta ? (
                <YourPlanCard
                  planId={activePlanMeta.id}
                  name={activePlanMeta.name}
                  weekNumber={activePlanQuery.data?.weekNumber ?? activePlanMeta.weekNumber}
                  days={planWeekDays}
                />
              ) : (
                <AIPlanCard savedPlans={plansQuery.data?.length ?? 0} weeklyGoal={weeklyGoal} />
              )}
            </Reveal>

            {suggestion && (
              <Reveal index={5}>
              <Card
                onPress={() => {
                  perfStart("open picker");
                  router.push({ pathname: "/workout/pick", params: { category: suggestion.category } });
                }}
                accessibilityLabel={`Suggested next: ${suggestion.label}. ${lastTrainedText(suggestion.daysAgo)}`}
                accessibilityHint="Opens Log workout"
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View
                    style={{
                      width: size.rowIcon,
                      height: size.rowIcon,
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceContainerHigh,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MuscleIcon category={suggestion.category} size={size.muscleIcon} active />
                  </View>
                  <View style={{ flex: 1, gap: spacing.xxs }}>
                    <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>Suggested next</Text>
                    <Text style={[typography.headlineSm, { color: colors.text }]} numberOfLines={1}>
                      {suggestion.label}
                    </Text>
                    <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{lastTrainedText(suggestion.daysAgo)}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={size.icon} color={colors.textSecondary} />
                </View>
              </Card>
              </Reveal>
            )}

            {recent.length > 0 && (
              <Reveal index={6} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text
                    accessibilityRole="header"
                    style={[typography.headlineSm, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]}
                  >
                    Recent activity
                  </Text>
                  <PressableScale
                    onPress={() => router.navigate("/(tabs)/history")}
                    accessibilityRole="button"
                    accessibilityLabel={`${sessions.length} sessions logged. Open History`}
                    style={{ minHeight: touchTarget, justifyContent: "center", paddingLeft: spacing.md }}
                  >
                    {({ pressed }) => (
                      <Text style={[typography.labelMd, { color: pressed ? colors.text : colors.textSecondary }]}>
                        {sessions.length} {sessions.length === 1 ? "session" : "sessions"} logged
                      </Text>
                    )}
                  </PressableScale>
                </View>
                {recent.map((s) => (
                  <RecentCard key={`${s.date}-${s.number}`} session={s} unit={unit} todayKey={todayKey} />
                ))}
              </Reveal>
            )}
          </>
        )}
      </ScrollView>

      <EmailVerificationPrompt
        visible={verification.promptOpen}
        user={user}
        dismissible={daysLeft !== 0}
        onSkip={verification.closePrompt}
        onVerified={verification.onVerified}
      />

      <ResumeWorkoutSheet from="home" />
    </>
  );
}

function lastTrainedText(daysAgo: number | null) {
  if (daysAgo === null) return "Not trained yet";
  if (daysAgo === 0) return "Last trained today";
  if (daysAgo === 1) return "Last trained yesterday";
  return `Last trained ${daysAgo} days ago`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
