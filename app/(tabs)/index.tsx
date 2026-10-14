import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, Text, View, type DimensionValue } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedMotion } from "react-native-reanimated";
import { useAuth } from "../../auth/AuthContext";
import { EmailVerificationPrompt } from "../../components/EmailVerificationPrompt";
import { CyclingHeadline } from "../../components/home/CyclingHeadline";
import { ResumeWorkoutSheet } from "../../components/log/ResumeWorkoutSheet";
import { MuscleIcon } from "../../components/muscle/MuscleIcon";
import { Avatar } from "../../components/ui/Avatar";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PressableScale,
  Reveal,
  ProgressRing,
  SkeletonBlock,
  StatusPill,
} from "../../components/ui";
import { verificationMessages } from "../../constants/verificationMessages";
import { useConnection } from "../../context/ConnectionContext";
import { clearEmailVerificationStart, getEmailVerificationStart, setEmailVerificationStart } from "../../db/syncMeta";
import { usePlan, usePlans } from "../../hooks/usePlan";
import { useProfile } from "../../hooks/useProfile";
import { useAllWeights } from "../../hooks/useWeights";
import { PRHighlight } from "../../components/home/PRHighlight";
import { WeightSnapshotCard } from "../../components/home/WeightSnapshotCard";
import { exerciseIndexFor, recentPRs } from "../../utils/exerciseHistory";
import { formatMuscles, getPlanWeekDays, isRestDayTitle, planDayShortName, type PlanDay, type PlanExercise } from "../../utils/planData";
import { useStartPlanSession } from "../../hooks/useStartPlanSession";
import { effectiveWeeklyGoal, isoWeekday } from "../../constants/trainingProfile";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useWorkoutSummary, type Session, type StreakSummary, type WeekSummary, type WeekVolume } from "../../hooks/useWorkoutSummary";
import { isNetworkApiError } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { alpha, motion, radius, semibold, size, spacing, touchTarget, tracking, typography, withAlpha } from "../../theme/tokens";
import { getInitials } from "../../utils/avatar";
import { perfStart } from "../../utils/perf";
import { displayWeight, weightLabel } from "../../utils/unitConversion";
import { formatDate, parseLocalDate } from "../../utils/weekUtils";

/* ==============================
   TYPES & CONSTANTS
   ============================== */
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MAX_CHIPS = 6;
const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_UPCOMING = 3;
/** Dates within this many days show a weekday name instead of "12 Sep". */
const WEEKDAY_WINDOW = 6;
const VERIFICATION_GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/* ==============================
   MAIN COMPONENT
   ============================== */
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
  const [verificationDaysLeft, setVerificationDaysLeft] = useState<number | null>(null);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
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

  /* ---------- email verification ---------- */
  const loadVerificationStatus = useCallback(async () => {
    if (!user) return;
    try {
      await user.reload();
    } catch {}

    if (user.emailVerified) {
      setVerificationDaysLeft(null);
      setDismissVerificationBanner(false);
      await clearEmailVerificationStart(user.uid);
      return;
    }

    let start = await getEmailVerificationStart(user.uid);
    if (!start) {
      start = Date.now();
      await setEmailVerificationStart(user.uid, start);
    }
    const elapsedDays = Math.floor((Date.now() - start) / DAY_MS);
    setVerificationDaysLeft(Math.max(0, VERIFICATION_GRACE_DAYS - elapsedDays));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadVerificationStatus();
    }, [loadVerificationStatus]),
  );

  useEffect(() => {
    if (!user || user.emailVerified) return;
    if (verificationDaysLeft === 0 && !showVerificationPrompt) {
      setShowVerificationPrompt(true);
    }
  }, [user, verificationDaysLeft, showVerificationPrompt]);

  /* ---------- refresh ---------- */
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
      await Promise.all([refetchAll(), loadVerificationStatus()]);
    } catch (error) {
      console.log("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  };

  /* ---------- screen state ---------- */
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

  /* ==============================
     RENDER
     ============================== */
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
        {user && !user.emailVerified && verificationDaysLeft !== null && !dismissVerificationBanner && (
          <Card style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
              <Ionicons
                name="mail-unread-outline"
                size={size.icon}
                color={verificationDaysLeft > 0 ? colors.accent : colors.danger}
              />
              <Text style={[typography.bodyLg, { color: colors.text, ...semibold, flex: 1 }]}>
                {verificationDaysLeft > 0
                  ? verificationMessages.bannerTitleSoft(verificationDaysLeft)
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
            <Button title={verificationMessages.bannerAction} variant="ghost" onPress={() => setShowVerificationPrompt(true)} />
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
                  router.push({ pathname: "/log/pick", params: { category: suggestion.category } });
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
        visible={showVerificationPrompt}
        user={user}
        dismissible={verificationDaysLeft !== 0}
        onSkip={() => setShowVerificationPrompt(false)}
        onVerified={async () => {
          setShowVerificationPrompt(false);
          if (user) {
            await clearEmailVerificationStart(user.uid);
          }
          await loadVerificationStatus();
        }}
      />

      <ResumeWorkoutSheet from="home" />
    </>
  );
}

/* ==============================
   TODAY CARD
   ============================== */

type ChipItem = { name: string; done?: boolean };

function TodayCard({
  loadingPlan,
  planDay,
  hasPlan,
  todaySession,
  nextSessionNumber,
  unit,
  trainingDayToday,
}: {
  loadingPlan: boolean;
  planId: string | null;
  planDay: PlanDay | null;
  hasPlan: boolean;
  todaySession: Session | null;
  nextSessionNumber: number;
  unit: "kg" | "lbs";
  /** From the user's chosen weekdays; null when they haven't picked any. */
  trainingDayToday: boolean | null;
}) {
  const { colors } = useTheme();
  const startPlanSession = useStartPlanSession();
  const volume = useCountUp(todaySession ? Math.round(displayWeight(todaySession.volumeKg, unit)) : 0, !!todaySession);
  // The one card you act on: same surface as the rest, lit by an accent glow (HeroGlow).
  const shell = {
    backgroundColor: colors.raised,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: "hidden" as const,
  };

  if (loadingPlan && !todaySession) {
    return (
      <View style={shell}>
        <HeroGlow />
        <SkeletonBlock width="25%" height={typography.labelMd.lineHeight} radius="sm" />
        <SkeletonBlock width="55%" height={typography.headlineMd.lineHeight} radius="sm" />
        <SkeletonBlock height={size.control} radius="lg" />
      </View>
    );
  }

  const sessionNumber = todaySession ? todaySession.number : nextSessionNumber;
  const trainingToday = hasPlan && !!planDay && planDay.sessionType !== "rest";
  // Opens History on today with the session expanded.
  const viewWorkout = () => router.navigate({ pathname: "/(tabs)/history", params: { date: todaySession?.date ?? formatDate(new Date()) } });
  const logWorkout = () => {
    perfStart("open picker");
    router.push("/log/pick");
  };

  // No plan and nothing logged: one action. AI plans have their own card on
  // Home, so they stay reachable whether or not you've trained today.
  if (!hasPlan && !todaySession) {
    const rest = trainingDayToday === false;
    return (
      <View style={shell}>
        <HeroGlow />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[typography.labelMd, { color: colors.accent, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>Today</Text>
          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh }}>
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Session {sessionNumber}</Text>
          </View>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text accessibilityRole="header" style={[typography.headlineMd, { color: colors.text }]}>
            {trainingDayToday == null ? "Ready to train?" : rest ? "Rest day" : "Training day"}
          </Text>
          <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>
            {rest ? "Not one of your training days. Train anyway if you feel like it." : "Nothing logged yet today."}
          </Text>
        </View>
        <Button title={rest ? "Start a workout anyway" : "Start workout"} icon="play" haptic fullWidth onPress={logWorkout} />
      </View>
    );
  }

  let badge: { label: string; done?: boolean } = { label: "Today" };
  let title: string;
  let subtitle: string;
  let chips: ChipItem[] = [];
  let button: { title: string; icon?: "play"; onPress: () => void; haptic?: boolean };

  if (trainingToday && planDay) {
    const planned = (planDay.exercises ?? []).filter((e) => e.name);
    const logged = new Set((todaySession?.exercises ?? []).map(normalizeExercise));
    const isLogged = (e: PlanExercise) =>
      logged.has(normalizeExercise(e.name ?? "")) || (!!e.exerciseId && logged.has(normalizeExercise(e.exerciseId)));
    const doneCount = planned.filter(isLogged).length;
    title = planDay.name || formatMuscles(planDay.targetMuscles) || "Workout";

    if (planned.length > 0 && doneCount === planned.length && todaySession) {
      // Plan complete.
      badge = { label: "Done today", done: true };
      subtitle = sessionSummary(todaySession, volume, unit);
      chips = planned.map((e) => ({ name: e.name!, done: true }));
      button = { title: "View workout", onPress: viewWorkout };
    } else if (doneCount > 0) {
      // In progress.
      subtitle = `${doneCount} of ${planned.length} exercises done`;
      chips = planned.map((e) => ({ name: e.name!, done: isLogged(e) }));
      const remaining = planned.filter((e) => !isLogged(e));
      button = {
        title: "Continue workout",
        icon: "play",
        haptic: true,
        onPress: () => startPlanSession(remaining, planDay.targetMuscles),
      };
    } else {
      // Planned, nothing logged.
      subtitle = [
        `${planned.length} ${planned.length === 1 ? "exercise" : "exercises"}`,
        planDay.estimatedDurationMinutes ? `about ${planDay.estimatedDurationMinutes} min` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      chips = planned.map((e) => ({ name: e.name! }));
      button = {
        title: "Start workout",
        icon: "play",
        haptic: true,
        onPress: () => startPlanSession(planned, planDay.targetMuscles),
      };
    }
  } else if (todaySession) {
    // No plan workout today (no plan, rest day, or day not in plan) but something was logged.
    badge = { label: "Logged today" };
    title = sessionName(todaySession);
    subtitle = sessionSummary(todaySession, volume, unit);
    chips = todaySession.exercises.map((name) => ({ name }));
    button = { title: "View workout", onPress: viewWorkout };
  } else {
    // Rest day (or nothing scheduled today), nothing logged.
    const note = planDay?.recoveryNote?.trim();
    title = "Rest day";
    subtitle = note && !isRestDayTitle(note) ? note : planDay ? "Recovery is part of the plan." : "Nothing is scheduled today.";
    button = { title: "Start a workout anyway", onPress: logWorkout };
  }

  const shown = chips.slice(0, MAX_CHIPS);

  return (
    <View style={shell}>
      <HeroGlow />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {badge.done && <MaterialIcons name="check-circle" size={size.iconSm} color={colors.accent} />}
          <Text style={[typography.labelMd, { color: colors.accent, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>{badge.label}</Text>
        </View>
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh }}>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Session {sessionNumber}</Text>
        </View>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[typography.headlineMd, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      {shown.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.inline }}>
          {shown.map((c, i) => (
            <View
              key={`${c.name}-${i}`}
              accessibilityLabel={c.done ? `${c.name}, done` : c.name}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceContainerHigh,
              }}
            >
              {c.done && <MaterialIcons name="check" size={size.iconXs} color={colors.accent} />}
              <Text style={[typography.labelSm, { color: c.done ? colors.textSecondary : colors.text }]}>{c.name}</Text>
            </View>
          ))}
          {chips.length > shown.length && (
            <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
              <Text style={[typography.labelSm, { color: colors.textSecondary }]}>+{chips.length - shown.length} more</Text>
            </View>
          )}
        </View>
      )}
      <Button title={button.title} icon={button.icon} haptic={button.haptic} fullWidth onPress={button.onPress} />
    </View>
  );
}

/** Accent glow from the top-left corner, fading into the card surface; text stays on the plain surface tone. */
function HeroGlow() {
  const { colors } = useTheme();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[withAlpha(colors.accentContainer, alpha.faint), withAlpha(colors.accentContainer, alpha.band), withAlpha(colors.accentContainer, 0)]}
      locations={[0, 0.45, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
    />
  );
}

/* ==============================
   WEEK + STREAK
   ============================== */

function WeekCard({ week, volume, unit }: { week: WeekSummary; volume: WeekVolume; unit: "kg" | "lbs" }) {
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

function StreakCard({ streak, week, todayKey }: { streak: StreakSummary; week: WeekSummary; todayKey: string }) {
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

/* ==============================
   YOUR PLAN
   ============================== */

function YourPlanCard({ planId, name, weekNumber, days }: { planId: string; name: string; weekNumber: number; days: PlanDay[] }) {
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
function AIPlanCard({ savedPlans, weeklyGoal }: { savedPlans: number; weeklyGoal: number | null }) {
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

/* ==============================
   RECENT CARD
   ============================== */

function RecentCard({ session, unit, todayKey }: { session: Session; unit: "kg" | "lbs"; todayKey: string }) {
  const { colors } = useTheme();
  const volume = useCountUp(Math.round(displayWeight(session.volumeKg, unit)), true);
  const day = relativeDay(session.date, todayKey);
  const count = `${session.exercises.length} ${session.exercises.length === 1 ? "exercise" : "exercises"}`;
  const name = sessionName(session);

  return (
    <PressableScale
      onPress={() => router.navigate("/(tabs)/history")}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${day}, ${count}${session.volumeKg > 0 ? `, total volume ${volume} ${weightLabel(unit)}` : ""}`}
      accessibilityHint="Opens History"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised,
      })}
    >
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
        <MuscleIcon category={session.mainCategory} size={size.muscleIcon} active />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyMdMedium, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
          {day} · {count}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        {session.volumeKg > 0 ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xs }}>
              <Text style={[typography.headlineSm, { color: colors.text }]}>{volume.toLocaleString()}</Text>
              <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{weightLabel(unit)}</Text>
            </View>
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Total volume</Text>
          </>
        ) : (
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
            {session.sets} {session.sets === 1 ? "set" : "sets"}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

/* ==============================
   AVATAR
   ============================== */

/* ==============================
   SKELETON (mirrors the loaded layout)
   ============================== */

function HomeSkeleton() {
  const { colors } = useTheme();
  const line = (w: DimensionValue, role: { lineHeight: number }) => <SkeletonBlock width={w} height={role.lineHeight} radius="sm" />;
  // Mirrors the loaded layout block for block (same surfaces, radii and gaps),
  // so nothing jumps when the real cards replace it.
  const surface = { backgroundColor: colors.raised, borderRadius: radius.xl, padding: spacing.lg };
  return (
    <View style={{ gap: spacing.lg }} accessibilityLabel="Loading your home screen">
      {/* Today */}
      <View style={[surface, { gap: spacing.md }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {line("28%", typography.labelMd)}
          {line("20%", typography.labelSm)}
        </View>
        {line("50%", typography.headlineMd)}
        {line("70%", typography.bodyMd)}
        <View style={{ flexDirection: "row", gap: spacing.inline }}>
          {(["24%", "30%", "26%"] as DimensionValue[]).map((w, i) => (
            <SkeletonBlock key={i} width={w} height={typography.labelSm.lineHeight + spacing.sm} radius="md" />
          ))}
        </View>
        <SkeletonBlock height={size.control} radius="lg" />
      </View>
      {/* This week + streak */}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {[0, 1].map((k) => (
          <View key={k} style={[surface, { flex: 1, gap: spacing.sm }]}>
            {line("55%", typography.labelSm)}
            {line("65%", typography.headlineMd)}
            {line("80%", typography.labelSm)}
            {line("90%", typography.labelSm)}
          </View>
        ))}
      </View>
      {/* Body weight */}
      <View style={[surface, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          {line("35%", typography.labelSm)}
          {line("45%", typography.headlineLg)}
          {line("55%", typography.labelMd)}
        </View>
        <SkeletonBlock width={size.goalCard - spacing.xl} height={size.control} radius="md" />
      </View>
      {/* Plan slot (your plan, or the AI plan card) */}
      <View style={[surface, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
        <SkeletonBlock width={size.rowIcon} height={size.rowIcon} radius="md" />
        <View style={{ flex: 1, gap: spacing.xs }}>
          {line("25%", typography.labelSm)}
          {line("50%", typography.headlineSm)}
          {line("75%", typography.labelSm)}
        </View>
      </View>
      {/* Suggested next */}
      <View style={[surface, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
        <SkeletonBlock width={size.rowIcon} height={size.rowIcon} radius="md" />
        <View style={{ flex: 1, gap: spacing.xs }}>
          {line("35%", typography.labelSm)}
          {line("30%", typography.headlineSm)}
          {line("45%", typography.labelSm)}
        </View>
      </View>
      {/* Recent activity */}
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: touchTarget }}>
          {line("40%", typography.headlineSm)}
          {line("25%", typography.labelMd)}
        </View>
        {[0, 1, 2].map((k) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.raised }}>
            <SkeletonBlock width={size.rowIcon} height={size.rowIcon} radius="md" />
            <View style={{ flex: 1, gap: spacing.xs }}>
              {line("45%", typography.bodyMdMedium)}
              {line("60%", typography.labelSm)}
            </View>
            <SkeletonBlock width={size.homeRing} height={typography.headlineSm.lineHeight} radius="sm" />
          </View>
        ))}
      </View>
    </View>
  );
}

/* ==============================
   HELPERS
   ============================== */

/** Counts up from 0 once, on first load; later changes jump straight to the value. */
function useCountUp(target: number, ready: boolean) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  const animated = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (animated.current || reduceMotion || target === 0) {
      animated.current = true;
      setValue(target);
      return;
    }
    animated.current = true;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / motion.countUpMs);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ready, reduceMotion]);

  return ready ? value : target;
}

/** Case/punctuation-insensitive key for matching plan exercises to logged ones. */
function normalizeExercise(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** "2 exercises · 6 sets · 900 kg" (volume omitted for bodyweight-only sessions). */
function sessionSummary(s: Session, volume: number, unit: "kg" | "lbs") {
  const parts = [
    `${s.exercises.length} ${s.exercises.length === 1 ? "exercise" : "exercises"}`,
    `${s.sets} ${s.sets === 1 ? "set" : "sets"}`,
  ];
  if (s.volumeKg > 0) parts.push(`${volume.toLocaleString()} ${weightLabel(unit)}`);
  return parts.join(" · ");
}

function sessionName(s: Session) {
  const main = s.categories.filter((c) => c !== "Other");
  if (main.length === 0) return "Workout";
  if (main.length <= 2) return main.join(" & ");
  return "Mixed session";
}

function relativeDay(date: string, todayKey: string) {
  const diff = Math.round((parseLocalDate(todayKey).getTime() - parseLocalDate(date).getTime()) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff <= WEEKDAY_WINDOW) return parseLocalDate(date).toLocaleDateString(undefined, { weekday: "long" });
  return parseLocalDate(date).toLocaleDateString(undefined, { day: "numeric", month: "short" });
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
