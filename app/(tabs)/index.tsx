import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { EmailVerificationPrompt } from "../../components/EmailVerificationPrompt";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ProgressRing,
  SectionHeader,
  Skeleton,
  StatTile,
  type IconName,
} from "../../components/ui";
import { verificationMessages } from "../../constants/verificationMessages";
import {
  clearEmailVerificationStart,
  getEmailVerificationStart,
  setEmailVerificationStart,
} from "../../db/syncMeta";
import { usePlan, usePlans } from "../../hooks/usePlan";
import { useProfile } from "../../hooks/useProfile";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useAllWorkouts } from "../../hooks/useWorkouts";
import { isNetworkApiError, type Workout } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { radius, spacing, touchTarget, typography } from "../../theme/tokens";
import { getInitials } from "../../utils/avatar";
import { displayWeight, weightLabel } from "../../utils/unitConversion";
import { formatDate, getWeekStart, parseLocalDate } from "../../utils/weekUtils";

/* ==============================
   TYPES
   ============================== */
interface RecentWorkout {
  date: string;
  exercises: string[];
  category: string;
  totalSets: number;
  totalVolume: number;
}

interface TrainingSuggestion {
  category: string;
  reason: string;
  daysSinceLastTrained: number;
  icon: IconName;
}

interface PlanExercise {
  name?: string;
  sets?: number;
  reps?: string;
}

interface PlanDay {
  day?: string;
  name?: string;
  sessionType?: "training" | "rest";
  targetMuscles?: string[];
  estimatedDurationMinutes?: number;
  recoveryNote?: string;
  exercises?: PlanExercise[];
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const VERIFICATION_GRACE_DAYS = 7;

/* ==============================
   MAIN COMPONENT
   ============================== */
export default function Home() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { unit } = useUnitPreference();

  const profileQuery = useProfile();
  const profile = profileQuery.data;
  const workoutsQuery = useAllWorkouts();
  const workouts = useMemo(() => workoutsQuery.data ?? [], [workoutsQuery.data]);
  const plansQuery = usePlans();
  const activePlanMeta = plansQuery.data?.find((p) => p.isActive);
  const activePlanQuery = usePlan(activePlanMeta?.id);

  const [refreshing, setRefreshing] = useState(false);
  const [verificationDaysLeft, setVerificationDaysLeft] = useState<number | null>(null);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [dismissVerificationBanner, setDismissVerificationBanner] = useState(false);

  /* ---------- derived data ---------- */
  const streak = useMemo(() => {
    const sortedDates = [...new Set(workouts.map((w) => w.date))].sort().reverse();
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    let count = 0;
    if (sortedDates[0] === today || sortedDates[0] === yesterday) {
      count = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const curr = new Date(sortedDates[i - 1]);
        const prev = new Date(sortedDates[i]);
        const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) count++;
        else break;
      }
    }
    return count;
  }, [workouts]);

  const workoutsThisWeek = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    return new Set(workouts.filter((w) => parseLocalDate(w.date) >= weekStart).map((w) => w.date.split("T")[0])).size;
  }, [workouts]);

  const recentWorkouts = useMemo((): RecentWorkout[] => {
    const groupedByDate = workouts.reduce(
      (acc, w) => {
        if (!acc[w.date]) acc[w.date] = [];
        acc[w.date].push(w);
        return acc;
      },
      {} as Record<string, Workout[]>,
    );

    return Object.keys(groupedByDate)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 3)
      .map((date) => {
        const dayWorkouts = groupedByDate[date];
        const exercises = [...new Set(dayWorkouts.map((w) => w.exercise))];
        const categories = [...new Set(dayWorkouts.map((w) => w.category || "Other"))];
        const totalSets = dayWorkouts.reduce((sum, w) => sum + w.sets.length, 0);
        const totalVolume = dayWorkouts.reduce(
          (sum, w) => sum + w.sets.reduce((s, set) => s + set.reps * set.weight, 0),
          0,
        );
        return { date, exercises, category: categories.length === 1 ? categories[0] : "Mixed", totalSets, totalVolume };
      });
  }, [workouts]);

  const suggestion = useMemo((): TrainingSuggestion | null => {
    const categoryLastTrained: Record<string, string> = {};
    for (const workout of workouts) {
      const cat = workout.category || "Other";
      if (!categoryLastTrained[cat] || workout.date > categoryLastTrained[cat]) {
        categoryLastTrained[cat] = workout.date;
      }
    }
    const mainCategories = ["Chest", "Back", "Shoulders", "Legs", "Arms", "Abs"];
    const today = new Date();
    let best: TrainingSuggestion | null = null;
    let maxDays = -1;
    for (const cat of mainCategories) {
      const lastDate = categoryLastTrained[cat];
      const daysSince = lastDate
        ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      if (daysSince > maxDays) {
        maxDays = daysSince;
        best = {
          category: cat,
          daysSinceLastTrained: daysSince,
          reason:
            daysSince >= 999
              ? "Never trained"
              : daysSince >= 7
                ? "Over a week ago"
                : daysSince >= 4
                  ? `${daysSince} days ago`
                  : `${daysSince} days rest`,
          icon: getCategoryIcon(cat),
        };
      }
    }
    return best;
  }, [workouts]);

  const planWeekDays = useMemo(
    () => getPlanWeekDays(activePlanQuery.data?.planData, activePlanQuery.data?.weekNumber),
    [activePlanQuery.data],
  );
  const todayPlanDay = useMemo(() => {
    const todayName = WEEKDAYS[new Date().getDay()];
    return planWeekDays.find((d) => d.day?.toLowerCase() === todayName) ?? null;
  }, [planWeekDays]);
  const planTrainingDays = planWeekDays.filter((d) => d.sessionType !== "rest").length;

  const weeklyTarget =
    planTrainingDays > 0
      ? { value: planTrainingDays, source: "Target from your plan" }
      : profile?.weeklyGoal && profile.weeklyGoal > 0
        ? { value: profile.weeklyGoal, source: "Your weekly goal" }
        : null;

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
    const elapsedDays = Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000));
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
  const isLoading = workoutsQuery.isLoading;
  const fatalError = workoutsQuery.isError && !workoutsQuery.data ? workoutsQuery.error : null;
  const isNewUser = !isLoading && !fatalError && workouts.length === 0 && !plansQuery.isLoading && !activePlanMeta;
  const hasPlannedTrainingToday = !!todayPlanDay && todayPlanDay.sessionType !== "rest";

  const firstName = (profile?.displayName ?? user?.displayName ?? "").trim().split(/\s+/)[0];
  const avatarPhoto = profile?.avatarUrl || user?.photoURL || null;
  const nameSource = profile?.displayName || user?.displayName || profile?.email || user?.email || "";
  const initials = nameSource ? getInitials(nameSource) : "";

  /* ==============================
     RENDER
     ============================== */
  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}
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
        {/* ========== HEADER ========== */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
              {getGreeting()}
              {firstName ? `, ${firstName}` : ""}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs }]}>
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </Text>
          </View>
          <Avatar key={avatarPhoto ?? "initials"} photoUri={avatarPhoto} initials={initials} onPress={() => router.navigate("/(tabs)/profile")} />
        </View>

        {/* Email verification banner */}
        {user && !user.emailVerified && verificationDaysLeft !== null && !dismissVerificationBanner && (
          <Card style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
              <Ionicons
                name="mail-unread-outline"
                size={20}
                color={verificationDaysLeft > 0 ? colors.accent : colors.danger}
                style={{ marginTop: 2 }}
              />
              <Text style={[typography.body, { color: colors.text, fontWeight: "600", flex: 1 }]}>
                {verificationDaysLeft > 0
                  ? verificationMessages.bannerTitleSoft(verificationDaysLeft)
                  : verificationMessages.bannerTitleHard}
              </Text>
              <Pressable
                onPress={() => setDismissVerificationBanner(true)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss verification reminder"
                style={{ width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", marginTop: -spacing.sm, marginRight: -spacing.sm }}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{verificationMessages.bannerBody}</Text>
            <Button title={verificationMessages.bannerAction} variant="ghost" onPress={() => setShowVerificationPrompt(true)} />
          </Card>
        )}

        {/* Fitness goal nudge */}
        {profile && !profile.fitnessGoal && (
          <Card
            onPress={() => router.navigate("/(tabs)/profile")}
            accessibilityLabel="Set your fitness goal. Needed to create your AI workout plan."
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Ionicons name="sparkles" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.text, fontWeight: "600" }]}>Set your fitness goal</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Needed to create your AI workout plan
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </Card>
        )}

        {isLoading ? (
          <HomeSkeleton />
        ) : fatalError ? (
          <Card>
            {isNetworkApiError(fatalError) ? (
              // The global offline banner owns the offline message and Retry.
              <EmptyState
                icon="barbell-outline"
                title="Workouts not loaded yet"
                body="They'll appear here once you're back online."
              />
            ) : (
              <ErrorState
                message="We couldn't load your workouts."
                onRetry={() => void refetchAll()}
                retrying={workoutsQuery.isFetching}
              />
            )}
          </Card>
        ) : isNewUser ? (
          <Card>
            <EmptyState
              icon="calendar-outline"
              title="Plan your week"
              body="Create a workout plan or log your first session."
              actionLabel="Create AI plan"
              onAction={() => router.navigate("/ai-plan")}
              secondaryActionLabel="Log a workout"
              onSecondaryAction={() => router.push("/add-workout")}
            />
          </Card>
        ) : (
          <>
            {/* ========== TODAY ========== */}
            {activePlanMeta && todayPlanDay && (
              <TodayCard planId={activePlanMeta.id} planName={activePlanMeta.name} day={todayPlanDay} />
            )}

            {/* ========== THIS WEEK ========== */}
            <Card style={{ gap: spacing.sm }}>
              <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
                This week
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md }}>
                {weeklyTarget ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexGrow: 1, flexBasis: 180 }}>
                    <ProgressRing
                      progress={workoutsThisWeek / weeklyTarget.value}
                      size={80}
                      accessibilityLabel={`${workoutsThisWeek} of ${weeklyTarget.value} workouts this week`}
                    >
                      <Text style={[typography.bodySmall, { color: colors.text, fontWeight: "700" }]}>
                        {workoutsThisWeek}/{weeklyTarget.value}
                      </Text>
                    </ProgressRing>
                    <View style={{ flex: 1 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                      <Text style={[typography.body, { color: colors.text, fontWeight: "600" }]}>
                        {workoutsThisWeek} of {weeklyTarget.value} workouts
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>{weeklyTarget.source}</Text>
                    </View>
                  </View>
                ) : (
                  <StatTile
                    value={workoutsThisWeek}
                    label="Workouts this week"
                    icon="barbell-outline"
                    style={{ flexBasis: 140, backgroundColor: colors.raised }}
                  />
                )}
                <StatTile
                  value={streak}
                  unit={streak === 1 ? "day" : "days"}
                  label="Streak"
                  icon="flame"
                  tone={streak > 0 ? "streak" : "default"}
                  style={{ flexBasis: 120, flexGrow: 1, backgroundColor: colors.raised }}
                />
              </View>
            </Card>

            {/* ========== SUGGESTED NEXT ========== */}
            {suggestion && suggestion.daysSinceLastTrained >= 3 && !hasPlannedTrainingToday && (
              <Card
                onPress={() => router.push("/add-workout")}
                accessibilityLabel={`Suggested next: train ${suggestion.category}. ${suggestion.reason}.`}
                accessibilityHint="Opens Log workout"
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <IconBadge name={suggestion.icon} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>Suggested next</Text>
                    <Text style={[typography.body, { color: colors.text, fontWeight: "600" }]}>
                      Train {suggestion.category.toLowerCase()}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{suggestion.reason}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
              </Card>
            )}

            {/* ========== RECENT ========== */}
            {recentWorkouts.length > 0 && (
              <View>
                <SectionHeader
                  title="Recent"
                  actionLabel="See all"
                  actionAccessibilityLabel="See all workouts in History"
                  onAction={() => router.navigate("/(tabs)/history")}
                />
                <Card padded={false}>
                  {recentWorkouts.map((workout, index) => (
                    <RecentRow key={workout.date} workout={workout} unit={unit} showDivider={index > 0} />
                  ))}
                </Card>
              </View>
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
    </>
  );
}

/* ==============================
   SECTIONS
   ============================== */

function TodayCard({ planId, planName, day }: { planId: string; planName: string; day: PlanDay }) {
  const { colors } = useTheme();
  const openPlan = () => router.push({ pathname: "/plan-detail", params: { id: planId } });

  if (day.sessionType === "rest") {
    const note = day.recoveryNote?.trim();
    const showNote = !!note && !isRestDayTitle(note);
    return (
      <Card style={{ gap: spacing.sm }}>
        <View>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Today · {planName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Ionicons name="moon-outline" size={20} color={colors.textSecondary} />
            <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
              Rest day
            </Text>
          </View>
          {showNote && (
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xxs }]}>{note}</Text>
          )}
        </View>
        <Button title="View plan" variant="secondary" onPress={openPlan} />
      </Card>
    );
  }

  const exercises = (day.exercises ?? []).filter((e) => e.name);
  const shown = exercises.slice(0, 3);
  const title = day.name || formatMuscles(day.targetMuscles) || "Workout";

  return (
    <Card style={{ gap: spacing.sm }}>
      <View>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>Today · {planName}</Text>
        <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
          {title}
        </Text>
        {!!day.estimatedDurationMinutes && (
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            About {day.estimatedDurationMinutes} min
          </Text>
        )}
      </View>
      {shown.length > 0 && (
        <View style={{ gap: spacing.xxs }}>
          {shown.map((e, i) => (
            <Text key={`${e.name}-${i}`} style={[typography.bodySmall, { color: colors.text }]}>
              {e.name}
              {typeof e.sets === "number" && e.reps ? (
                <Text style={{ color: colors.textSecondary }}>{`  ${e.sets} × ${e.reps}`}</Text>
              ) : null}
            </Text>
          ))}
          {exercises.length > shown.length && (
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              +{exercises.length - shown.length} more
            </Text>
          )}
        </View>
      )}
      <Button title="Start workout" icon="play" fullWidth onPress={() => router.push("/add-workout")} />
      <Button title="View plan" variant="secondary" onPress={openPlan} />
    </Card>
  );
}

function Avatar({ photoUri, initials, onPress }: { photoUri: string | null; initials: string; onPress: () => void }) {
  const { colors } = useTheme();
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = !!photoUri && !photoFailed;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      style={({ pressed }) => ({
        width: touchTarget,
        height: touchTarget,
        borderRadius: touchTarget / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.border : colors.raised,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      {showPhoto ? (
        <Image
          source={{ uri: photoUri }}
          onError={() => setPhotoFailed(true)}
          style={{ width: touchTarget, height: touchTarget }}
        />
      ) : initials ? (
        <Text style={[typography.body, { color: colors.accent, fontWeight: "700" }]} maxFontSizeMultiplier={1.2}>
          {initials}
        </Text>
      ) : (
        <Ionicons name="person" size={22} color={colors.accent} />
      )}
    </Pressable>
  );
}

function RecentRow({
  workout,
  unit,
  showDivider,
}: {
  workout: RecentWorkout;
  unit: "kg" | "lbs";
  showDivider: boolean;
}) {
  const { colors } = useTheme();
  const dateLabel = formatRelativeDate(workout.date);
  const detail =
    workout.totalVolume > 0
      ? `${Math.round(displayWeight(workout.totalVolume, unit)).toLocaleString()} ${weightLabel(unit)}`
      : `${workout.exercises.length} ${workout.exercises.length === 1 ? "exercise" : "exercises"}`;
  const exerciseSummary =
    workout.exercises.slice(0, 2).join(", ") +
    (workout.exercises.length > 2 ? ` +${workout.exercises.length - 2}` : "");

  return (
    <Pressable
      onPress={() => router.navigate("/(tabs)/history")}
      accessibilityRole="button"
      accessibilityLabel={`${workout.category}, ${dateLabel}, ${detail}. ${exerciseSummary}`}
      accessibilityHint="Opens History"
      style={({ pressed }) => ({
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: showDivider ? 1 : 0,
        borderTopColor: colors.border,
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      <IconBadge name={getCategoryIcon(workout.category)} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { color: colors.text, fontWeight: "600" }]}>{workout.category}</Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={2}>
          {exerciseSummary}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", maxWidth: "40%" }}>
        <Text style={[typography.bodySmall, { color: colors.text }]}>{dateLabel}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{detail}</Text>
      </View>
    </Pressable>
  );
}

function IconBadge({ name }: { name: IconName }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.md,
        backgroundColor: colors.accentSubtle,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={name} size={20} color={colors.accent} />
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ gap: spacing.sm }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="70%" height={24} />
        <Skeleton height={48} radius="md" />
      </Card>
      <Card style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
        <Skeleton width={80} height={80} radius="pill" />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Skeleton width="60%" />
          <Skeleton width="40%" height={12} />
        </View>
      </Card>
      <Card style={{ gap: spacing.sm }}>
        <Skeleton width="30%" height={20} />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </Card>
    </View>
  );
}

/* ==============================
   HELPERS
   ============================== */

function getPlanWeekDays(planData: unknown, weekNumber: number | undefined): PlanDay[] {
  const data = planData as { weeks?: { days?: PlanDay[] }[]; days?: PlanDay[] } | null | undefined;
  if (Array.isArray(data?.weeks) && data.weeks.length > 0) {
    const index = Math.min(Math.max((weekNumber ?? 1) - 1, 0), data.weeks.length - 1);
    return data.weeks[index]?.days ?? [];
  }
  if (Array.isArray(data?.days)) return data.days;
  return [];
}

function isRestDayTitle(note: string): boolean {
  const normalized = note.toLowerCase().replace(/[^a-z ]/g, "").trim();
  return normalized === "rest" || normalized === "rest day";
}

function formatMuscles(muscles: string[] | undefined): string {
  if (!muscles || muscles.length === 0) return "";
  const list = muscles.map((m) => m.toLowerCase());
  const joined = list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getCategoryIcon(category: string): IconName {
  const icons: Record<string, IconName> = {
    Chest: "fitness-outline",
    Back: "body-outline",
    Shoulders: "barbell-outline",
    Legs: "walk-outline",
    Arms: "hand-left-outline",
    Abs: "ellipse-outline",
    Cardio: "heart-outline",
    "Full Body": "body-outline",
    Mixed: "layers-outline",
  };
  return icons[category] || "barbell-outline";
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = dateStr.split("T")[0];
  const todayStr = today.toISOString().split("T")[0];
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (dateOnly === todayStr) return "Today";
  if (dateOnly === yesterdayStr) return "Yesterday";

  const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 7) return `${diff}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
