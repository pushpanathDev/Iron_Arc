import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../providers/AuthContext";
import { ExportSheet } from "../../components/profile/ExportSheet";
import { MonthCalendar } from "../../components/history/MonthCalendar";
import { SessionCard, sessionTitle } from "../../components/history/SessionCard";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { FilterChip } from "../../components/ui/FilterChip";
import { Reveal } from "../../components/ui/Reveal";
import { SkeletonBlock } from "../../components/ui/Skeleton";
import { useToast } from "../../providers/ToastContext";
import { displayCategory } from "../../hooks/workoutDraft";
import { useAchievementUnlockHandler } from "../../hooks/useAchievements";
import { useProfile } from "../../hooks/useProfile";
import { useStartPlanSession } from "../../hooks/useStartPlanSession";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { groupSessions, type SessionGroup } from "../../hooks/useWorkoutSummary";
import { useAllWorkouts, workoutKeys } from "../../hooks/useWorkouts";
import { isPendingDelete } from "../../hooks/workoutCache";
import { scheduleWorkoutDelete, UNDO_WINDOW_MS, undoWorkoutDelete } from "../../hooks/workoutDeleteQueue";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { getInitials } from "../../utils/avatar";
import { exerciseIndexFor, exerciseKey, prExerciseDays } from "../../utils/exerciseHistory";
import { createPageLogger } from "../../utils/logger";
import { perfStart } from "../../utils/perf";
import { formatDate, parseLocalDate } from "../../utils/weekUtils";

const log = createPageLogger("History");
const DAY_MS = 86_400_000;
const NO_WORKOUTS: never[] = [];

const monthKeyOf = (d: Date) => formatDate(new Date(d.getFullYear(), d.getMonth(), 1)).slice(0, 7);
const sessionKey = (g: SessionGroup) => `${g.date}-${g.list[0].id}`;

export default function History() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const params = useLocalSearchParams<{ date?: string }>();
  const { data: rawWorkouts, isLoading, refetch } = useAllWorkouts();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const handleUnlocks = useAchievementUnlockHandler();
  const startSession = useStartPlanSession();
  const { unit } = useUnitPreference();

  const workouts = rawWorkouts ?? NO_WORKOUTS;
  const todayKey = formatDate(new Date());

  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Swiped session awaiting confirmation (and how to snap its card back).
  const [confirm, setConfirm] = useState<{ group: SessionGroup; close: () => void } | null>(null);

  // Data
  const groups = useMemo(() => groupSessions(workouts), [workouts]);
  const trainedDays = useMemo(() => new Set(workouts.map((w) => w.date.slice(0, 10))), [workouts]);
  const prWorkoutIds = useMemo(() => {
    const days = prExerciseDays(exerciseIndexFor(workouts).index);
    return new Set(workouts.filter((w) => days.has(`${exerciseKey(w.exercise)}|${w.date.slice(0, 10)}`)).map((w) => w.id));
  }, [workouts]);

  const monthKey = monthKeyOf(month);
  const monthGroups = useMemo(() => groups.filter((g) => g.date.startsWith(monthKey)), [groups, monthKey]);
  const monthCategories = useMemo(
    () => [...new Set(monthGroups.flatMap((g) => g.list.map((w) => w.category)).filter(Boolean))].sort(),
    [monthGroups],
  );
  const visible = useMemo(
    () =>
      monthGroups.filter((g) => (!selectedDay || g.date === selectedDay) && (!category || g.list.some((w) => w.category === category))),
    [monthGroups, selectedDay, category],
  );
  const byDay = useMemo(() => {
    const out: { date: string; groups: SessionGroup[] }[] = [];
    for (const g of visible) {
      const last = out[out.length - 1];
      if (last && last.date === g.date) last.groups.push(g);
      else out.push({ date: g.date, groups: [g] });
    }
    return out;
  }, [visible]);

  const monthTrainingDays = new Set(monthGroups.map((g) => g.date)).size;
  const monthSets = monthGroups.reduce((n, g) => n + g.list.reduce((m, w) => m + w.sets.length, 0), 0);
  const isCurrentMonth = monthKey === todayKey.slice(0, 7);
  const monthName = month.toLocaleDateString(undefined, { month: "long" });

  // Opened for a day (Home's "View workout")
  useEffect(() => {
    const d = params.date;
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    setMonth(parseLocalDate(d));
    setSelectedDay(d);
    setCategory(null);
    const first = groups.find((g) => g.date === d);
    if (first) setExpanded(sessionKey(first));
    // Only when the requested day changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.date]);

  // Month / filters
  const changeMonth = useCallback((delta: number) => {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    setSelectedDay(null);
    setCategory(null);
    setExpanded(null);
  }, []);
  const toggleExpanded = useCallback((key: string) => setExpanded((cur) => (cur === key ? null : key)), []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  // Delete a whole session (through the delete queue)
  const deleteSession = useCallback(
    async (group: SessionGroup) => {
      if (!user) return;
      const ids = group.list.map((w) => w.id).filter((id) => !isPendingDelete(id));
      if (ids.length === 0) return;
      await queryClient.cancelQueries({ queryKey: workoutKeys.all });
      for (const id of ids) scheduleWorkoutDelete(queryClient, id, { onDeleted: (unlocked) => void handleUnlocks(unlocked) });
      const exercises = new Set(group.list.map((w) => w.exercise)).size;
      showToast({
        type: "undo",
        message: "Session deleted",
        subtitle: `${sessionTitle(group)} · ${exercises} ${exercises === 1 ? "exercise" : "exercises"}`,
        actionLabel: "Undo",
        duration: UNDO_WINDOW_MS,
        onAction: () => {
          const restored = ids.filter((id) => undoWorkoutDelete(queryClient, id)).length;
          if (restored) log.info(`Undo: restored ${restored} workout(s)`);
        },
      });
    },
    [user, queryClient, handleUnlocks, showToast],
  );

  const askDelete = useCallback((group: SessionGroup, close: () => void) => setConfirm({ group, close }), []);

  const editWorkout = useCallback((id: string) => router.push({ pathname: "/workout/edit", params: { id } }), []);
  const repeatSession = useCallback(
    (group: SessionGroup) => startSession(group.list.map((w) => ({ name: w.exercise, sets: w.sets.length, category: w.category }))),
    [startSession],
  );

  const nameSource = profile?.displayName || user?.displayName || profile?.email || user?.email || "";
  const avatarPhoto = profile?.avatarUrl || user?.photoURL || null;
  const sessionsLabel = `${monthGroups.length} ${monthGroups.length === 1 ? "session" : "sessions"} logged ${isCurrentMonth ? "this month" : `in ${monthName}`}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: spacing.screen, paddingRight: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ width: size.tileSm, height: size.tileSm, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
            <MaterialIcons name="history" size={size.icon} color={colors.accent} />
          </View>
          <Text style={[typography.headlineMd, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
            History
          </Text>
        </View>
        <Avatar key={avatarPhoto ?? "initials"} photoUri={avatarPhoto} initials={nameSource ? getInitials(nameSource) : ""} onPress={() => router.navigate("/(tabs)/profile")} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.card} />}
      >
        {isLoading && workouts.length === 0 ? (
          <HistorySkeleton />
        ) : workouts.length === 0 ? (
          <Reveal>
            <EmptyCard
              icon="fitness-center"
              title="No workouts yet"
              body="Your logged sessions will show up here, day by day."
              action={
                <Button
                  title="Start workout"
                  icon="play"
                  onPress={() => {
                    perfStart("open picker");
                    router.push("/workout/pick");
                  }}
                  fullWidth
                />
              }
            />
          </Reveal>
        ) : (
          <>
            {/* Month summary + export */}
            <Reveal index={0} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>Training log</Text>
                <Text style={[typography.bodyMd, { color: colors.text }]}>{sessionsLabel}</Text>
              </View>
              <Pressable
                onPress={() => setExportOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Export workout history"
                style={({ pressed }) => ({
                  width: size.control,
                  height: size.control,
                  borderRadius: radius.lg,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? colors.surfaceContainerHighest : colors.surfaceContainerHigh,
                })}
              >
                <MaterialIcons name="ios-share" size={size.icon} color={colors.text} />
              </Pressable>
            </Reveal>

            <Reveal index={1}>
              <MonthCalendar
                month={month}
                onPrev={() => changeMonth(-1)}
                onNext={() => changeMonth(1)}
                trainedDays={trainedDays}
                selected={selectedDay}
                onSelect={setSelectedDay}
                todayKey={todayKey}
                footer={
                  monthTrainingDays > 0
                    ? `${monthTrainingDays} training ${monthTrainingDays === 1 ? "day" : "days"} · ${monthSets} ${monthSets === 1 ? "set" : "sets"}`
                    : `Nothing logged ${isCurrentMonth ? "this month yet" : `in ${monthName}`}`
                }
              />
            </Reveal>

            {/* Filters: only groups trained this month */}
            {monthCategories.length > 1 && (
              <Reveal index={2}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                  <FilterChip label="All" active={!category} onPress={() => setCategory(null)} />
                  {monthCategories.map((c) => (
                    <FilterChip key={c} label={displayCategory(c)} active={category === c} onPress={() => setCategory((cur) => (cur === c ? null : c))} />
                  ))}
                </ScrollView>
              </Reveal>
            )}

            {/* Selected-day note */}
            {selectedDay && (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[typography.labelMd, { color: colors.accent }]}>
                  Showing {parseLocalDate(selectedDay).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                </Text>
                <Button title="Show whole month" variant="ghost" onPress={() => setSelectedDay(null)} />
              </View>
            )}

            {/* Sessions by day */}
            <Reveal index={3} style={{ gap: spacing.md }}>
              {byDay.length === 0 ? (
                <EmptyCard
                  icon={selectedDay ? "event-busy" : "filter-alt-off"}
                  title={
                    selectedDay
                      ? "Nothing logged that day"
                      : category
                        ? `No ${displayCategory(category)} sessions in ${monthName}`
                        : `Nothing logged in ${monthName}`
                  }
                  body={selectedDay || category ? "Clear the filter to see the rest of the month." : "Pick another month or start a workout."}
                />
              ) : (
                byDay.map((day) => (
                  <View key={day.date} style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={[typography.headlineSm, { color: colors.text }]}>{dayLabel(day.date, todayKey)}</Text>
                      <Text style={[typography.labelMd, { color: colors.textSecondary }]}>
                        {day.groups.length} {day.groups.length === 1 ? "session" : "sessions"}
                      </Text>
                    </View>
                    {day.groups.map((g) => {
                      const key = sessionKey(g);
                      return (
                        <SessionCard
                          key={key}
                          group={g}
                          sessionKey={key}
                          unit={unit}
                          pr={g.list.some((w) => prWorkoutIds.has(w.id))}
                          prWorkoutIds={prWorkoutIds}
                          expanded={expanded === key}
                          onToggle={toggleExpanded}
                          onDelete={askDelete}
                          onEdit={editWorkout}
                          onRepeat={repeatSession}
                        />
                      );
                    })}
                  </View>
                ))
              )}
            </Reveal>

            {byDay.length > 0 && (
              <Text style={[typography.labelSm, { color: colors.textMuted, textAlign: "center" }]}>Tap a session for its sets · swipe left to delete</Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Confirm before a swipe deletes a whole session */}
      <ConfirmDialog
        visible={!!confirm}
        destructive
        title={confirm && confirm.group.list.length === 1 ? "Delete this workout?" : "Delete this session?"}
        message={confirm ? deleteMessage(confirm.group) : ""}
        confirmLabel="Delete"
        onConfirm={() => {
          const g = confirm?.group;
          setConfirm(null);
          if (g) void deleteSession(g);
        }}
        onCancel={() => {
          confirm?.close();
          setConfirm(null);
        }}
      />

      {/* Export */}
      <ExportSheet visible={exportOpen} onClose={() => setExportOpen(false)} displayName={profile?.displayName ?? ""} />
    </View>
  );
}

// Pieces

function EmptyCard({ icon, title, body, action }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; body: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.md, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.raised }}>
      <View style={{ width: size.iconBadge, height: size.iconBadge, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
        <MaterialIcons name={icon} size={size.iconLg} color={colors.accent} />
      </View>
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Text style={[typography.headlineSm, { color: colors.text, textAlign: "center", textTransform: "uppercase", letterSpacing: tracking.headlineWide }]}>{title}</Text>
        <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>{body}</Text>
      </View>
      {action ? <View style={{ alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

function HistorySkeleton() {
  return (
    <View style={{ gap: spacing.md }} accessibilityLabel="Loading history">
      <SkeletonBlock height={size.control} radius="lg" />
      <SkeletonBlock height={size.ring * 2.6} radius="xl" />
      <SkeletonBlock height={size.control} radius="lg" />
      {[0, 1, 2].map((k) => (
        <SkeletonBlock key={k} height={size.goalCard * 0.8} radius="lg" />
      ))}
    </View>
  );
}

/** "This removes 5 exercises and 18 logged sets…" (true: there is a short Undo afterwards). */
function deleteMessage(group: SessionGroup) {
  const exercises = new Set(group.list.map((w) => w.exercise)).size;
  const sets = group.list.reduce((n, w) => n + w.sets.length, 0);
  return `This removes ${exercises} ${exercises === 1 ? "exercise" : "exercises"} and ${sets} logged ${sets === 1 ? "set" : "sets"} (${sessionTitle(group)}) from your training history. You'll have a few seconds to undo.`;
}

/** "Today", "Yesterday", "Mon 5 Oct". */
function dayLabel(key: string, todayKey: string) {
  const diff = Math.round((parseLocalDate(todayKey).getTime() - parseLocalDate(key).getTime()) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return parseLocalDate(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
