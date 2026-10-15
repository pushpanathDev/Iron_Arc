import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import type { NavigationAction } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../providers/AuthContext";
import { ActiveSetCard } from "../../components/workout/ActiveSetCard";
import { ExerciseStrip } from "../../components/workout/ExerciseStrip";
import { PRBanner, type NewRecord } from "../../components/workout/PRBanner";
import { formatClock, RestBar } from "../../components/workout/RestBar";
import { PendingSets, SetTable } from "../../components/workout/SetTable";
import { MuscleIcon } from "../../components/muscle/MuscleIcon";
import { Button } from "../../components/ui/Button";
import { Reveal } from "../../components/ui/Reveal";
import { Sheet } from "../../components/ui/Sheet";
import { TextField } from "../../components/ui/TextField";
import { useConnection } from "../../providers/ConnectionContext";
import { useToast } from "../../providers/ToastContext";
import {
  activeSetOf,
  addSet,
  cancelEdit,
  clearDraft,
  clearRest,
  completeSet,
  deleteSet,
  displayCategory,
  doneSets,
  draftName,
  extendRest,
  getDraft,
  hasDoneSets,
  insertSet,
  loadDraft,
  moveExercise,
  removeExercise,
  setActiveExercise,
  setDate,
  setExerciseNotes,
  startEditSet,
  startRest,
  updateDraft,
  updateSet,
  useWorkoutDraft,
  writeNow,
  type DraftExercise,
  type LastTimeLookup,
  type WorkoutDraft,
} from "../../hooks/workoutDraft";
import { saveWorkout } from "../../hooks/workoutSave";
import { useAchievementUnlockHandler } from "../../hooks/useAchievements";
import { historyPrefill, useExerciseIndex } from "../../hooks/useWorkoutData";
import { cancelRestEndNotification, DEFAULT_NOTIFICATION_PREFERENCES, getNotificationPreferences, scheduleRestEndNotification } from "../../notifications/notificationService";
import { useTheme } from "../../theme/theme";
import { motion, radius, size, spacing, tracking, typography } from "../../theme/tokens";
import {
  allSets,
  checkPR,
  indexAsOf,
  prDetail,
  exerciseKey,
  formatSet,
  lastTimeText,
  previousSetAt,
  type ExerciseHistory,
  type ExerciseSummary,
  type LoggedSet,
} from "../../utils/exerciseHistory";
import { perfEndAfterFrame, perfStart } from "../../utils/perf";
import { toKg, weightLabel } from "../../utils/unitConversion";
import { formatDate, parseLocalDate, FIRST_DAY_OF_WEEK } from "../../utils/weekUtils";

const REST_EXTEND_SECONDS = 15;
/** Same limit as the backend's workout notes. */
const NOTES_MAX = 500;
/** A rest that ended longer ago than this (app was closed) ends silently. */
const REST_LATE_MS = 2000;
const MINUTE_MS = 60_000;
/** Horizontal swipe on the exercise view: start tracking / switch exercise. */
const SWIPE_ACTIVATE = 24;
const SWIPE_FAIL_Y = 14;
const SWIPE_SWITCH = 64;

// The active session: one exercise in focus, the others in a strip.

export default function LogSession() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showToast } = useToast();
  const handleUnlocks = useAchievementUnlockHandler();
  const connection = useConnection();
  const draft = useWorkoutDraft();

  const [record, setRecord] = useState<NewRecord | null>(null);
  const [menuFor, setMenuFor] = useState<DraftExercise | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<DraftExercise | null>(null);
  const [leaveAction, setLeaveAction] = useState<NavigationAction | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // The Android date dialog reopens whenever its value or onChange changes. The rest timer
  // re-renders this screen every second, so both must stay the same while it is open, or the
  // dialog snaps back to its first day and the day you tapped is lost.
  const [datePickerValue, setDatePickerValue] = useState<Date | null>(null);
  const onDatePicked = useCallback((event: DateTimePickerEvent, d?: Date) => {
    setDatePickerValue(null);
    if (event.type === "set" && d) {
      const key = formatDate(d);
      updateDraft((s) => setDate(s, key === formatDate(new Date()) ? null : key));
    }
  }, []);
  const allowLeave = useRef(false);

  // Opened directly (e.g. after a restart): load the saved session, else go to the picker.
  useEffect(() => {
    if (getDraft() || !user) return;
    void loadDraft(user.uid).then((d) => {
      if (!d) router.replace("/workout/pick");
    });
  }, [user]);

  /* ---------- history: shared index, built once per workouts change ---------- */
  // Backdated session: "Last time", prefill and records use history up to that date only.
  const full = useExerciseIndex();
  const { index, summaries } = useMemo(() => indexAsOf(full.index, full.summaries, draft?.date ?? null), [full.index, full.summaries, draft?.date]);
  const unit = draft?.unit ?? "kg";
  const lastTime: LastTimeLookup = useMemo(() => historyPrefill(index, unit), [index, unit]);
  const kgOf = useCallback((weight: number | null, reps: number | null): LoggedSet => ({ weight: toKg(weight ?? 0, unit), reps: reps ?? 0 }), [unit]);

  /** Sets that were PRs when logged. No PRs on an exercise's first-ever session. */
  const prSets = useMemo(() => {
    const out = new Set<string>();
    for (const ex of draft?.exercises ?? []) {
      const h = index.get(exerciseKey(ex.name));
      if (!h?.sessions.length) continue;
      const prior = allSets(h).slice();
      for (const s of ex.sets) {
        if (!s.done) continue;
        const set = kgOf(s.weight, s.reps);
        if (checkPR(prior, set).isPR) out.add(s.id);
        prior.push(set);
      }
    }
    return out;
  }, [draft?.exercises, index, kgOf]);

  /* ---------- rest timer (timestamp based, so it survives the background) ---------- */
  const [now, setNow] = useState(Date.now());
  const rest = draft?.rest ?? null;
  useEffect(() => {
    if (!rest) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest]);
  const restRemaining = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  // Rest settings (Notifications → Rest timer): default length and in-app vibration.
  const restPrefs = useRef({ seconds: DEFAULT_NOTIFICATION_PREFERENCES.restDefaultSeconds, vibrate: true });
  useFocusEffect(
    useCallback(() => {
      void getNotificationPreferences().then((p) => (restPrefs.current = { seconds: p.restDefaultSeconds, vibrate: p.restVibrate }));
    }, []),
  );
  useEffect(() => {
    if (!rest || rest.endsAt > now) return;
    if (now - rest.endsAt < REST_LATE_MS && AppState.currentState === "active" && restPrefs.current.vibrate) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    updateDraft(clearRest);
  }, [rest, now]);

  const extend = () => {
    updateDraft((d) => extendRest(d, REST_EXTEND_SECONDS));
    const r = getDraft()?.rest;
    if (r) void scheduleRestEndNotification(r.endsAt, "Rest over");
  };
  const skipRest = () => {
    updateDraft(clearRest);
    void cancelRestEndNotification();
  };

  /* ---------- leaving ---------- */
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (allowLeave.current) return;
        const d = getDraft();
        if (!d) return;
        if (!hasDoneSets(d)) {
          // Nothing logged yet: nothing to keep.
          void cancelRestEndNotification();
          void clearDraft(d.userId);
          return;
        }
        e.preventDefault();
        setLeaveAction(e.data.action);
      }),
    [navigation],
  );

  const leave = async (keep: boolean) => {
    const action = leaveAction;
    setLeaveAction(null);
    allowLeave.current = true;
    void cancelRestEndNotification();
    updateDraft(clearRest);
    if (keep) await writeNow();
    else await clearDraft(user?.uid);
    if (action) navigation.dispatch(action);
  };

  /* ---------- switching exercises ---------- */
  const go = useCallback((delta: number) => {
    const d = getDraft();
    if (!d) return;
    const i = d.exercises.findIndex((e) => e.key === d.activeKey);
    const next = d.exercises[i + delta];
    if (next) {
      Haptics.selectionAsync().catch(() => {});
      updateDraft((s) => setActiveExercise(s, next.key));
    }
  }, []);
  const select = useCallback((key: string) => updateDraft((s) => setActiveExercise(s, key)), []);
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-SWIPE_ACTIVATE, SWIPE_ACTIVATE])
        .failOffsetY([-SWIPE_FAIL_Y, SWIPE_FAIL_Y])
        .runOnJS(true)
        .onEnd((e) => {
          if (e.translationX <= -SWIPE_SWITCH) go(1);
          else if (e.translationX >= SWIPE_SWITCH) go(-1);
        }),
    [go],
  );

  // Slide direction follows the order of the exercises.
  const activeIndex = draft ? draft.exercises.findIndex((e) => e.key === draft.activeKey) : -1;
  const lastIndex = useRef(activeIndex);
  const direction = activeIndex >= lastIndex.current ? 1 : -1;
  useEffect(() => {
    lastIndex.current = activeIndex;
  }, [activeIndex]);

  const openPicker = () => {
    perfStart("open picker");
    router.push({ pathname: "/workout/pick", params: { mode: "add" } });
  };

  /* ---------- set actions ---------- */
  const complete = (ex: DraftExercise, setId: string) => {
    const d = getDraft();
    if (!d) return;
    const editing = d.editingSetId === setId;
    const idx = ex.sets.findIndex((s) => s.id === setId);
    const set = ex.sets[idx];
    const h = index.get(exerciseKey(ex.name));

    if (!editing && h?.sessions.length) {
      const prior = [...allSets(h), ...ex.sets.slice(0, idx).filter((s) => s.done).map((s) => kgOf(s.weight, s.reps))];
      const logged = kgOf(set.weight, set.reps);
      const { isPR, previous, kind } = checkPR(prior, logged);
      if (isPR && previous && kind) {
        setRecord({
          id: set.id,
          title: `New record! ${ex.name} ${formatSet(logged, unit)}`,
          detail: prDetail(logged, previous, kind, unit),
        });
      }
    }

    updateDraft((s) => completeSet(s, ex.key, setId, lastTime));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!editing) {
      const seconds = ex.restSeconds ?? restPrefs.current.seconds;
      updateDraft((s) => startRest(s, seconds));
      void scheduleRestEndNotification(Date.now() + seconds * 1000, `Next: ${ex.name}, set ${idx + 2}`);
    }
  };

  const deleteWithUndo = (ex: DraftExercise, setId: string) => {
    const idx = ex.sets.findIndex((s) => s.id === setId);
    const set = ex.sets[idx];
    if (!set) return;
    updateDraft((d) => deleteSet(d, ex.key, setId));
    showToast({
      type: "undo",
      message: `Set ${idx + 1} deleted`,
      subtitle: ex.name,
      actionLabel: "Undo",
      onAction: () => updateDraft((d) => insertSet(d, ex.key, set, idx)),
    });
  };

  const remove = (ex: DraftExercise) => {
    updateDraft((s) => removeExercise(s, ex.key));
    showToast({ type: "info", message: "Exercise removed", subtitle: ex.name });
  };

  /* ---------- finish ---------- */
  const openSummary = () => {
    perfStart("finish sheet");
    setSummaryOpen(true);
  };
  useEffect(() => {
    if (summaryOpen) perfEndAfterFrame("finish sheet");
  }, [summaryOpen]);

  const save = async () => {
    if (!user || savingRef.current) return;
    savingRef.current = true;
    setSaving(true); // spinner on the very next frame
    perfStart("save (batch request)");
    try {
      if (connection.state === "offline" || connection.state === "unreachable") {
        setSummaryOpen(false);
        showToast({ type: "warning", message: "Can't save while offline", subtitle: "Your workout is kept on this phone. Finish when you're back online." });
        return;
      }
      const result = await saveWorkout(queryClient);
      perfEndAfterFrame("save (batch request)");
      if (!result.saved) {
        setSummaryOpen(false);
        const status = (result.error as { status?: number } | undefined)?.status;
        showToast({
          type: "error",
          message: "Couldn't save workout",
          subtitle:
            status === 404
              ? "The server doesn't support saving sessions yet. Nothing was saved; your workout is kept here."
              : "Nothing was saved. Your workout is kept here; tap Finish to try again.",
        });
        return;
      }
      const d = getDraft();
      const sets = d ? d.exercises.reduce((n, e) => n + doneSets(e).length, 0) : 0;
      const name = d ? draftName(d) : "Workout";
      void handleUnlocks(result.newlyUnlocked);
      allowLeave.current = true;
      void cancelRestEndNotification();
      await clearDraft(user.uid);
      setSummaryOpen(false);
      // Back to the tabs already underneath, then Home. (replace("/(tabs)") stacked a new
      // copy of every tab on each save; they all kept re-rendering and each save got slower.)
      if (router.canDismiss()) router.dismissAll();
      else router.replace("/(tabs)");
      router.navigate("/(tabs)");
      showToast({ type: "success", message: "Workout saved", subtitle: `${name} · ${sets} ${sets === 1 ? "set" : "sets"}` });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!draft) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const active = draft.exercises.find((e) => e.key === draft.activeKey) ?? null;
  const anyDone = hasDoneSets(draft);
  // Target shows arm sub-groups ("Biceps & Triceps"); workouts still save the category.
  const categories = [...new Set(draft.exercises.map((e) => e.subgroup ?? e.category))];
  const target = categories.length ? categories.map(displayCategory).join(" & ") : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xs, gap: spacing.xs }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: size.control, height: size.control, alignItems: "center", justifyContent: "center" }}
        >
          <MaterialIcons name="arrow-back" size={size.iconLg} color={colors.textSecondary} />
        </Pressable>
        <Text style={[typography.headlineSm, { flex: 1, color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
          Log workout
        </Text>
        <DateChip date={draft.date} onPress={() => setDatePickerValue(draft.date ? parseLocalDate(draft.date) : new Date())} />
      </View>

      {/* Name, target, rest */}
      <Reveal index={0} style={{ paddingHorizontal: spacing.screen, gap: spacing.xxs }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
          <Text style={[typography.headlineMd, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
            {draftName(draft)}
          </Text>
          {rest && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, borderWidth: size.divider, borderColor: colors.warning }}
              accessibilityLabel={`Rest ${formatClock(restRemaining)}`}
            >
              <MaterialIcons name="timer" size={size.iconXs} color={colors.warning} />
              <Text style={[typography.labelLg, { color: colors.warning, fontVariant: ["tabular-nums"] }]}>Rest {formatClock(restRemaining)}</Text>
            </View>
          )}
        </View>
        {target && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            {categories.slice(0, 3).map((c) => (
              <MuscleIcon key={c} category={c} size={size.iconSm} active />
            ))}
            <Text style={[typography.labelMd, { color: colors.textSecondary, flexShrink: 1 }]} numberOfLines={1}>
              Target: {target}
            </Text>
          </View>
        )}
      </Reveal>

      {/* Sticky exercise strip */}
      <Reveal index={1} style={{ paddingVertical: spacing.sm }}>
        <ExerciseStrip exercises={draft.exercises} activeKey={draft.activeKey} onSelect={select} onAdd={openPicker} />
      </Reveal>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={spacing.xl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xl, gap: spacing.lg, flexGrow: 1 }}
      >
        {record && <PRBanner record={record} onDone={() => setRecord(null)} />}

        <GestureDetector gesture={swipe}>
          <View style={{ flexGrow: 1 }} collapsable={false}>
            {active ? (
              <SlideIn key={active.key} direction={direction}>
                <ExerciseView
                  draft={draft}
                  exercise={active}
                  history={index.get(exerciseKey(active.name))}
                  summary={summaries.get(exerciseKey(active.name))}
                  prSets={prSets}
                  lastTime={lastTime}
                  onMenu={() => setMenuFor(active)}
                  onComplete={(setId) => complete(active, setId)}
                  onDelete={(setId) => deleteWithUndo(active, setId)}
                />
              </SlideIn>
            ) : (
              <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl }}>
                <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>No exercises yet. Add one to start logging.</Text>
                <Button title="Add exercise" icon="add" variant="tonal" onPress={openPicker} />
              </View>
            )}
          </View>
        </GestureDetector>
      </KeyboardAwareScrollView>

      {/* Footer */}
      <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.sm, gap: spacing.sm, backgroundColor: colors.bg }}>
        {rest && <RestBar remaining={restRemaining} onExtend={extend} onSkip={skipRest} />}
        <Button
          title="Finish workout"
          icon="flag-outline"
          onPress={openSummary}
          disabled={!anyDone}
          fullWidth
          style={{ minHeight: size.ctaTall }}
          accessibilityHint={anyDone ? "Shows a summary before saving" : "Complete at least one set first"}
        />
      </View>

      {datePickerValue && (
        <DateTimePicker
          value={datePickerValue}
          mode="date"
          firstDayOfWeek={FIRST_DAY_OF_WEEK}
          maximumDate={new Date()}
          onChange={onDatePicked}
        />
      )}

      {/* Exercise menu */}
      <Sheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.name ?? ""}>
        {menuFor && (
          <View style={{ gap: spacing.sm }}>
            <Button
              title="Move left"
              icon="arrow-back"
              variant="secondary"
              fullWidth
              disabled={draft.exercises[0]?.key === menuFor.key}
              onPress={() => {
                updateDraft((d) => moveExercise(d, menuFor.key, -1));
                setMenuFor(null);
              }}
            />
            <Button
              title="Move right"
              icon="arrow-forward"
              variant="secondary"
              fullWidth
              disabled={draft.exercises[draft.exercises.length - 1]?.key === menuFor.key}
              onPress={() => {
                updateDraft((d) => moveExercise(d, menuFor.key, 1));
                setMenuFor(null);
              }}
            />
            <Button
              title="Remove exercise"
              icon="trash-outline"
              variant="destructive"
              fullWidth
              onPress={() => {
                const ex = menuFor;
                setMenuFor(null);
                if (doneSets(ex).length > 0) setConfirmRemove(ex);
                else remove(ex);
              }}
            />
          </View>
        )}
      </Sheet>

      {/* Confirm removing an exercise with completed sets */}
      <Sheet
        visible={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title={`Remove ${confirmRemove?.name ?? "exercise"}?`}
        subtitle={confirmRemove ? `Its ${doneSets(confirmRemove).length} completed ${doneSets(confirmRemove).length === 1 ? "set" : "sets"} will be removed from this workout.` : undefined}
      >
        <View style={{ gap: spacing.sm }}>
          <Button
            title="Remove exercise"
            variant="destructive"
            fullWidth
            onPress={() => {
              const ex = confirmRemove;
              setConfirmRemove(null);
              if (ex) remove(ex);
            }}
          />
          <Button title="Cancel" variant="ghost" onPress={() => setConfirmRemove(null)} fullWidth />
        </View>
      </Sheet>

      {/* Leave */}
      <Sheet visible={!!leaveAction} onClose={() => setLeaveAction(null)} title="Leave workout?" subtitle="Your completed sets aren't saved to your history yet.">
        <View style={{ gap: spacing.sm }}>
          <Button title="Keep for later" onPress={() => void leave(true)} fullWidth />
          <Button title="Discard workout" variant="destructive" onPress={() => void leave(false)} fullWidth />
          <Button title="Cancel" variant="ghost" onPress={() => setLeaveAction(null)} fullWidth />
        </View>
      </Sheet>

      {/* Summary */}
      <SummarySheet
        visible={summaryOpen}
        draft={draft}
        prCount={prSets.size}
        saving={saving}
        onSave={() => void save()}
        onClose={() => !saving && setSummaryOpen(false)}
      />
    </View>
  );
}

/**
 * Short horizontal slide when switching exercises. A plain animated transform
 * rather than a Reanimated `entering` layout animation: on Android those could
 * leave buttons inside only partly tappable.
 */
function SlideIn({ direction, children }: { direction: number; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(reduceMotion ? 0 : direction * size.control);
  const fade = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    offset.value = withTiming(0, { duration: motion.slideMs });
    fade.value = withTiming(1, { duration: motion.slideMs });
  }, [offset, fade]);
  const style = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateX: offset.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

// Active exercise

const ExerciseView = memo(function ExerciseView({
  draft,
  exercise: ex,
  history,
  summary,
  prSets,
  lastTime,
  onMenu,
  onComplete,
  onDelete,
}: {
  draft: WorkoutDraft;
  exercise: DraftExercise;
  history: ExerciseHistory | undefined;
  summary: ExerciseSummary | undefined;
  prSets: Set<string>;
  lastTime: LastTimeLookup;
  onMenu: () => void;
  onComplete: (setId: string) => void;
  onDelete: (setId: string) => void;
}) {
  const { colors } = useTheme();
  const unit = draft.unit;
  const lastTimeAt = useCallback((i: number) => formatSet(previousSetAt(history, i), unit), [history, unit]);
  const activeSet = activeSetOf(ex, draft.editingSetId);
  const activeIndex = activeSet ? ex.sets.findIndex((s) => s.id === activeSet.id) : -1;
  const editing = !!activeSet && draft.editingSetId === activeSet.id;
  const onEdit = useCallback((setId: string) => updateDraft((d) => startEditSet(d, ex.key, setId)), [ex.key]);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
        <View style={{ flex: 1, gap: spacing.xxs, paddingTop: spacing.xs }}>
          <Text style={[typography.headlineMd, { color: colors.text }]} numberOfLines={2} accessibilityRole="header">
            {ex.name}
          </Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{lastTimeText(summary, unit)}</Text>
        </View>
        <Pressable
          onPress={onMenu}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${ex.name}`}
          style={{ width: size.control, height: size.control, marginRight: -spacing.sm, alignItems: "center", justifyContent: "center" }}
        >
          <MaterialIcons name="more-vert" size={size.icon} color={colors.textSecondary} />
        </Pressable>
      </View>

      <SetTable exercise={ex} activeSetId={activeSet?.id ?? null} lastTimeAt={lastTimeAt} prSets={prSets} onEdit={onEdit} onDelete={onDelete} />

      {activeSet && (
        <ActiveSetCard
          setNumber={activeIndex + 1}
          editing={editing}
          lastTime={lastTimeAt(activeIndex)}
          unit={unit}
          values={{ weight: activeSet.weight, reps: activeSet.reps }}
          onChange={(values) => updateDraft((d) => updateSet(d, ex.key, activeSet.id, values))}
          onComplete={() => onComplete(activeSet.id)}
          onRemove={() => updateDraft((d) => deleteSet(d, ex.key, activeSet.id))}
          onDelete={() => onDelete(activeSet.id)}
          onCancelEdit={() => updateDraft(cancelEdit)}
          exercise={ex.name}
        />
      )}

      <PendingSets exercise={ex} activeSetId={activeSet?.id ?? null} lastTimeAt={lastTimeAt} />
      <Button title="Add set" icon="add" variant="ghost" onPress={() => updateDraft((d) => addSet(d, ex.key, lastTime))} fullWidth />
      <ExerciseNote exKey={ex.key} notes={ex.notes ?? ""} />
    </View>
  );
});

/** Optional note for this exercise ("felt heavy", "new grip"), saved with it. */
function ExerciseNote({ exKey, notes }: { exKey: string; notes: string }) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <TextField
        label="Note (optional)"
        value={notes}
        onChangeText={(t) => updateDraft((d) => setExerciseNotes(d, exKey, t))}
        placeholder="How did it feel? Anything to remember?"
        multiline
        maxLength={NOTES_MAX}
      />
    </View>
  );
}

// Pieces

function DateChip({ date, onPress }: { date: string | null; onPress: () => void }) {
  const { colors } = useTheme();
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 24 * 60 * MINUTE_MS));
  const label =
    !date || date === today
      ? "Today"
      : date === yesterday
        ? "Yesterday"
        : parseLocalDate(date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Workout date: ${label}`}
      accessibilityHint="Change the date (past dates allowed)"
      style={({ pressed }) => ({
        minHeight: size.control,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xxs,
        paddingLeft: spacing.md,
        paddingRight: spacing.sm,
        marginRight: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceContainerHighest : colors.surfaceContainerHigh,
      })}
    >
      <Text style={[typography.labelLg, { color: colors.text }]}>{label}</Text>
      <MaterialIcons name="arrow-drop-down" size={size.iconLg} color={colors.textSecondary} />
    </Pressable>
  );
}

function SummarySheet({
  visible,
  draft,
  prCount,
  saving,
  onSave,
  onClose,
}: {
  visible: boolean;
  draft: WorkoutDraft;
  prCount: number;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  if (!visible) return null;
  const logged = draft.exercises.filter((e) => doneSets(e).length > 0);
  const sets = logged.reduce((n, e) => n + doneSets(e).length, 0);
  const volume = logged.reduce((v, e) => v + doneSets(e).reduce((s, x) => s + (x.weight ?? 0) * (x.reps ?? 0), 0), 0);
  const skipped = draft.exercises.length - logged.length;

  // No duration: it isn't stored, and logging after training would show ~1 min.
  const stats: [string, string][] = [
    ["Exercises", String(logged.length)],
    ["Sets", String(sets)],
    ["Volume", `${Math.round(volume).toLocaleString()} ${weightLabel(draft.unit)}`],
    ["PRs", String(prCount)],
  ];

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Finish workout?"
      subtitle={`${draftName(draft)}${skipped > 0 ? ` · ${skipped} ${skipped === 1 ? "exercise has" : "exercises have"} no completed sets and won't be saved` : ""}`}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {stats.map(([label, value]) => (
          <View key={label} style={{ flexGrow: 1, flexBasis: "40%", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.raised, gap: spacing.xxs }}>
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[typography.headlineSm, { color: label === "PRs" && prCount > 0 ? colors.warning : colors.text }]}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={{ gap: spacing.sm }}>
        <Button title="Save workout" onPress={onSave} loading={saving} disabled={saving} fullWidth haptic style={{ minHeight: size.ctaTall }} />
        <Button title="Keep logging" variant="ghost" onPress={onClose} disabled={saving} fullWidth />
      </View>
    </Sheet>
  );
}
